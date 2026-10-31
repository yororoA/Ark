import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { chromium, webkit, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const useWebKit = process.env.TEST_BROWSER === 'webkit'
let browser

before(async () => {
  browser = await (useWebKit ? webkit : chromium).launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, design = 'archive', viewport = { width: 320, height: 568 }) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  t.after(() => context.close())
  if (useWebKit) {
    // The contract fixture rotates its token on every SSE subscription. In
    // WebKit this races the initial history requests and can invalidate the
    // account mid-test. These cases exercise UI state with a controlled SSE
    // response; live SSE/token renewal stays covered by verify:blog and Chrome.
    await context.route('**/api/blog/sse/subscribe', route => route.fulfill({
      status: 200, contentType: 'text/event-stream', body: 'retry: 600000\n: UI fixture\n\n',
    }))
  }
  await context.addInitScript(design => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.locale', 'en')
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, design)
  const login = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { username: `chat-app-${design}-${Date.now()}`, password: 'fixture-password' },
  })
  assert.equal(login.status(), 200, 'Use the isolated verify:blog:preview fixture')
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  const unauthorized = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() === 401) unauthorized.push(new URL(response.url()).pathname) })
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  t.after(() => assert.deepEqual(unauthorized, [], 'The fixture account remains authenticated'))
  return page
}

const conversations = page => page.locator('nav[class*="conversation-list"]')
const composer = page => page.locator('form[class*="chat-compose"]')
const mascotToggle = page => page.getByRole('button', { name: /Show mascot/, includeHidden: true })
async function openConversation(page, id) {
  await conversations(page).locator(`button[data-conversation="${id}"]`).tap()
  await expect(page.getByRole('log')).toBeVisible()
  await expect(conversations(page)).toBeHidden()
  await expect(mascotToggle(page)).toBeHidden()
  assert.equal(await page.evaluate(() => localStorage.getItem('ark.mascot:v1')), 'off', 'Opening a thread preserves the mascot preference')
}
async function backToList(page) {
  await page.getByRole('button', { name: 'Back to chats', exact: true }).tap()
  await expect(conversations(page)).toBeVisible()
  await expect(page.getByRole('log')).toBeHidden()
  await expect(mascotToggle(page)).toBeVisible()
}

for (const design of ['archive', 'rain', 'p3r', 'prism']) {
  test(`phone chat navigation and independent drafts: ${design}`, async t => {
    const page = await session(t, design)
    await page.goto(`${baseURL}/chat`)
    const list = conversations(page)
    await expect(list).toBeVisible()
    await expect(page.getByRole('log')).toBeHidden()
    await expect(mascotToggle(page)).toBeVisible()
    const rows = await list.locator('button').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, height: box.height }
    }))
    assert(rows.length > 1)
    assert(rows.every(box => box.left >= 0 && box.right <= 321 && box.height >= 70), 'Full-width touch rows fit the phone')
    if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-chat-list.png` })

    await openConversation(page, 'group')
    const input = composer(page).getByRole('textbox')
    await input.fill('Group draft, kept while choosing another conversation')
    await expect(page.getByRole('log').locator('[class*="message-row"]').last()).toBeVisible()
    await page.getByRole('log').getByRole('button', { name: /^Reply / }).last().tap()
    const reply = await composer(page).locator('[class*="reply-target"]').innerText()
    await composer(page).locator('input[type="file"]').setInputFiles({
      name: 'chat-draft.png', mimeType: 'image/png', buffer: await readFile(new URL('../public/logo.png', import.meta.url)),
    })
    await backToList(page)
    await expect(list.locator('[data-conversation="group"]')).toBeFocused()
    await openConversation(page, 'admin')
    await expect(composer(page).getByRole('textbox')).toHaveValue('')
    await composer(page).getByRole('textbox').fill('Private draft')
    await backToList(page)
    await openConversation(page, 'group')
    await expect(input).toHaveValue('Group draft, kept while choosing another conversation')
    await expect(composer(page).locator('[class*="reply-target"]')).toHaveText(reply)
    await expect(composer(page).getByText('chat-draft.png', { exact: true })).toBeVisible()
    assert.equal(await page.locator('[class*="chat-main"]').count(), 1, 'Only the active conversation owns a live history view')

    await composer(page).getByRole('button', { name: 'Remove attachment chat-draft.png', exact: true }).tap()
    await composer(page).getByRole('button', { name: 'Cancel', exact: true }).tap()
    if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-chat-thread.png` })
    await input.focus()
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 360 })
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 20 })
      visualViewport.dispatchEvent(new Event('resize'))
      visualViewport.dispatchEvent(new Event('scroll'))
    })
    await expect.poll(() => page.locator('[class*="blog-root"]').evaluate(el => el.getBoundingClientRect().height)).toBe(360)
    const composeBounds = await composer(page).boundingBox()
    assert(composeBounds.y >= 20 && composeBounds.y + composeBounds.height <= 381, 'Composer stays above the mobile keyboard')
    await expect.poll(() => page.getByRole('log').evaluate(el => el.clientHeight)).toBeGreaterThan(40)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
  })
}

test('phone chat restores the reading position after switching conversations', async t => {
  const page = await session(t, 'archive', { width: 390, height: 844 })
  await page.goto(`${baseURL}/chat?conversation=group`)
  const log = page.getByRole('log')
  await expect(log.locator('[class*="message-row"]').last()).toBeVisible()
  if (useWebKit) {
    // Mobile WebKit does not implement Playwright's mouse wheel. Native focus
    // scrolls the history button into view; Home retains the keyboard path.
    await log.getByRole('button', { name: 'Earlier messages', exact: true }).focus()
    await page.keyboard.press('Home')
  } else {
    await log.hover()
    await page.mouse.wheel(0, -10000)
  }
  await expect.poll(() => log.evaluate(el => el.scrollTop)).toBe(0)
  await log.getByRole('button', { name: 'Earlier messages', exact: true }).click()
  await expect.poll(() => log.evaluate(el => el.scrollTop)).toBeGreaterThan(100)
  let previous = -1
  let stable = 0
  await expect.poll(async () => {
    const current = await log.evaluate(el => el.scrollTop)
    stable = Math.abs(current - previous) < 1 ? stable + 1 : 0
    previous = current
    return stable
  }, { intervals: [100] }).toBeGreaterThanOrEqual(3)
  const before = await log.evaluate(el => el.scrollTop)
  await backToList(page)
  await openConversation(page, 'group')
  await expect.poll(async () => Math.abs((await log.evaluate(el => el.scrollTop)) - before), { message: 'Reopening the same hidden room retains its position' }).toBeLessThan(5)
  assert(await log.locator('[class*="message-row"]').evaluateAll(rows => rows.every(row => row.getBoundingClientRect().height > 0)), 'Hidden measurements do not collapse message rows')
  await backToList(page)
  await openConversation(page, 'admin')
  await backToList(page)
  await openConversation(page, 'group')
  await expect.poll(() => log.evaluate(el => el.scrollTop)).toBeGreaterThan(100)
  await expect.poll(async () => Math.abs((await log.evaluate(el => el.scrollTop)) - before)).toBeLessThan(5)
})

test('desktop chat keeps its two panes and conversation drafts', async t => {
  const page = await session(t, 'archive', { width: 1280, height: 800 })
  await page.goto(`${baseURL}/chat`)
  await expect(conversations(page)).toBeVisible()
  await expect(page.getByRole('log')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to chats', exact: true })).toBeHidden()
  await expect(mascotToggle(page)).toBeVisible()
  const listBounds = await conversations(page).boundingBox()
  const threadBounds = await page.locator('[class*="chat-main"]').boundingBox()
  assert(listBounds.x + listBounds.width <= threadBounds.x + 1, 'Conversation list remains beside messages')
  await composer(page).getByRole('textbox').fill('Desktop group draft')
  await conversations(page).locator('[data-conversation="admin"]').click()
  await expect(composer(page).getByRole('textbox')).toHaveValue('')
  await conversations(page).locator('[data-conversation="group"]').click()
  await expect(composer(page).getByRole('textbox')).toHaveValue('Desktop group draft')
  await expect(mascotToggle(page)).toBeVisible()
})

test('conversation switching waits for every concurrent attachment retry', async t => {
  const page = await session(t, 'archive', { width: 1280, height: 800 })
  let calls = 0
  const complete = []
  await page.context().route('**/api/blog/media/upload', async route => {
    const call = ++calls
    if (call <= 2) return route.fulfill({ status: 503, json: { message: 'Retry fixture' } })
    await new Promise(resolve => complete.push(async () => {
      await route.fulfill({ json: { success: true, data: {
        id: `retry-asset-${call}`, scope: 'chat', filename: `retry-${call}.png`, mime: 'image/png',
        url: `${baseURL}/logo.png`, bytes: 16, status: 'staged',
      } } })
      resolve()
    }))
  })
  await page.goto(`${baseURL}/chat`)
  const file = await readFile(new URL('../public/logo.png', import.meta.url))
  await composer(page).locator('input[type="file"]').setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: file },
    { name: 'two.png', mimeType: 'image/png', buffer: file },
  ])
  await composer(page).getByRole('button', { name: 'Send', exact: true }).click()
  const first = composer(page).getByRole('button', { name: 'Try again one.png', exact: true })
  const second = composer(page).getByRole('button', { name: 'Try again two.png', exact: true })
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  await first.click()
  await second.click()
  await expect.poll(() => complete.length).toBe(2)
  const privateChat = conversations(page).locator('[data-conversation="admin"]')
  await expect(privateChat).toBeDisabled()
  await complete[0]()
  await expect(composer(page).locator('[data-status="done"]')).toHaveCount(1)
  await expect(privateChat).toBeDisabled()
  await complete[1]()
  await expect(privateChat).toBeEnabled()
  await privateChat.click()
  await conversations(page).locator('[data-conversation="group"]').click()
  await expect(composer(page).getByText('retry-3.png', { exact: true })).toBeVisible()
  await expect(composer(page).getByText('retry-4.png', { exact: true })).toBeVisible()
})
