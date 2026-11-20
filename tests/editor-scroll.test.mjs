import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname), 'Editor tests may authenticate only against a loopback fixture')
const longText = Array.from({ length: 220 }, (_, index) => `Line ${String(index).padStart(3, '0')} · quiet words.`).join('\n')
let browser

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
})
after(async () => { await browser?.close() })

async function session(t, { width = 1440, design = 'archive' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', isMobile: width < 600, hasTouch: width < 600 })
  t.after(() => context.close())
  await context.addInitScript(({ design }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.locale', 'en')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, { design })
  const response = await context.request.post(`${baseURL}/api/auth/login`, { data: { username: 'tester', password: 'fixture-password' } })
  assert.equal(response.status(), 200, 'Use scripts/verify-blog.mjs --serve with its isolated backend')
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught editor errors'))
  return { context, page }
}

async function editor(page, route = '/articles/new') {
  await page.goto(`${baseURL}${route}`)
  const input = page.locator('main textarea').first()
  await expect(input).toBeVisible({ timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await input.fill(longText)
  await expect.poll(() => input.evaluate(element => element.clientHeight)).toBeGreaterThan(4000)
  return input
}

async function placeCaret(page, input, line = 175) {
  await input.evaluate((element, line) => {
    const lines = element.value.split('\n')
    const cursor = lines.slice(0, line).join('\n').length + 1 + 12
    element.focus({ preventScroll: true })
    element.setSelectionRange(cursor, cursor)
    const style = getComputedStyle(element)
    const y = element.getBoundingClientRect().top + scrollY + parseFloat(style.paddingTop) + line * parseFloat(style.lineHeight)
    scrollTo({ top: y - innerHeight * .45, behavior: 'instant' })
  }, line)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return page.evaluate(() => scrollY)
}

async function position(input) {
  return input.evaluate(element => ({ y: scrollY, internal: element.scrollTop, height: element.getBoundingClientRect().height, cursor: element.selectionStart, length: element.value.length, focused: document.activeElement === element }))
}

for (const config of [{ width: 1440, design: 'archive' }, { width: 390, design: 'voyage' }, { width: 320, design: 'offset' }]) {
  test(`long editor keeps the caret viewport during deletion and typing: ${config.design} ${config.width}`, async t => {
    const { page } = await session(t, config)
    const input = await editor(page)
    await placeCaret(page, input)
    const initial = await position(input)
    assert(initial.y > 3000, 'Exercise a long document well below the first screen')
    let maximumScrollDelta = 0
    for (const key of ['Backspace', 'a', 'Enter', 'Backspace', 'Delete']) {
      const before = await position(input)
      await page.keyboard.press(key)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const after = await position(input)
      maximumScrollDelta = Math.max(maximumScrollDelta, Math.abs(after.y - before.y))
      assert(Math.abs(after.y - before.y) < 40, `${key} should keep the same reading area: ${JSON.stringify({ before, after })}`)
      assert.equal(after.focused, true, 'Typing retains focus')
      assert(after.internal < 2, 'The expanded editor does not acquire an inner scroll position')
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), config.width)
    t.diagnostic(`Largest viewport movement across five edits: ${maximumScrollDelta}px`)
  })
}

test('deleting a selected tail shrinks the editor only to its real content height', async t => {
  const { page } = await session(t)
  const input = await editor(page, '/articles/aaaaaaaaaaaaaaaaaaaaaaaa/edit')
  await placeCaret(page, input)
  await input.evaluate(element => {
    const start = element.value.indexOf('Line 180')
    element.setSelectionRange(start, element.value.length)
  })
  const before = await position(input)
  await page.keyboard.press('Backspace')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const after = await position(input)
  const maximumScroll = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)
  assert(after.height < before.height - 800, 'The editor shrinks when complete lines are removed')
  assert(Math.abs(after.y - Math.min(before.y, maximumScroll)) < 40, 'Only genuine document-end clamping may move the viewport')
  assert.equal(await input.inputValue(), longText.slice(0, longText.indexOf('Line 180')))
  assert.equal(after.focused, true)
  assert(after.internal < 2)
})

test('preview round trip preserves the draft and restores a fully sized mobile editor', async t => {
  const { page } = await session(t, { width: 320, design: 'offset' })
  const input = await editor(page)
  const height = await input.evaluate(element => element.clientHeight)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.locator('main [class*="markdown"]')).toContainText('Line 219 · quiet words.')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(input).toHaveValue(longText)
  await expect.poll(() => input.evaluate(element => element.clientHeight)).toBe(height)
  await placeCaret(page, input)
  const before = await position(input)
  await page.keyboard.press('Backspace')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const after = await position(input)
  assert(Math.abs(after.y - before.y) < 40, 'The remounted editor keeps its viewport when editing resumes')
})

test('width changes remeasure wrapping without leaving content clipped or excess height', async t => {
  const { page } = await session(t)
  const input = await editor(page)
  await input.fill(longText.replaceAll('quiet words.', 'quiet words across a changing page width.'))
  const wideHeight = await input.evaluate(element => element.clientHeight)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => input.evaluate(element => element.clientHeight)).toBeGreaterThan(wideHeight * 1.5)
  assert(await input.evaluate(element => element.scrollHeight <= element.clientHeight + 1), 'Wrapped mobile content fits the expanded field')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(() => input.evaluate(element => element.clientHeight)).toBe(wideHeight)
})

test('moment autosave retains the mobile editing viewport and saves subsequent deletion', async t => {
  const { page } = await session(t, { width: 390, design: 'voyage' })
  const input = await editor(page, '/moments/new')
  await page.getByLabel('Title', { exact: true }).fill('Long editor autosave regression')
  await placeCaret(page, input)
  const before = await position(input)
  await expect(page.getByText('Draft autosaved', { exact: true })).toBeVisible({ timeout: 10000 })
  const saved = await position(input)
  assert(Math.abs(saved.y - before.y) < 40, 'Autosave status updates retain the editing viewport')
  const response = page.waitForResponse(response => response.url().endsWith('/api/blog/moments/post') && response.request().method() === 'POST')
  await page.keyboard.press('Backspace')
  const result = await response
  assert.equal(result.status(), 200)
  assert.equal(result.request().postDataJSON().content, await input.inputValue(), 'The changed text is what autosave sends')
  const after = await position(input)
  assert(Math.abs(after.y - before.y) < 40, 'Deleting and saving the new draft does not move the viewport')
  assert.equal(after.focused, true)
  assert(after.internal < 2)
})
