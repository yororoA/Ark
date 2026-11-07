import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10580'
const path = '/articles/abababababababababababab'
const shots = process.env.CODE_SCREENSHOT_DIR
let browser
before(async () => { browser = await chromium.launch({ headless: true }); if (shots) await mkdir(shots, { recursive: true }) })
after(async () => browser?.close())

async function session(t, { mode = 'light', locale = 'en', width = 320, clipboard = 'success' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 780 }, colorScheme: mode, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(({ mode, locale, clipboard }) => {
    localStorage.setItem('ark.design.v1', 'voyage'); localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', locale); localStorage.setItem('ark.mascot:v1', 'off')
    window.__copiedCode = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
      if (clipboard === 'failure') throw new DOMException('Permission denied', 'NotAllowedError')
      window.__copiedCode.push(value)
    } } })
  }, { mode, locale, clipboard })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()) })
  t.after(() => assert.deepEqual(errors, [], 'Code blocks must not emit browser or React warnings'))
  await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' })
  await expect(page.getByTestId('voyage-code-block')).toHaveCount(4)
  await page.evaluate(() => document.fonts.ready)
  return { page, context }
}

for (const mode of ['light', 'dark']) test(`Voyage code labels and native horizontal scrolling fit a 320px ${mode} page`, async t => {
  const { page } = await session(t, { mode, locale: mode === 'light' ? 'en' : 'zh' })
  const blocks = page.getByTestId('voyage-code-block')
  await expect(page.getByTestId('voyage-code-language')).toHaveText(['ts', '中文'])
  await expect(blocks.nth(2).getByTestId('voyage-code-language')).toHaveCount(0)
  await expect(blocks.nth(3).locator('button')).toBeDisabled()
  await expect(blocks.nth(3).locator('code')).toHaveText('')
  const wide = blocks.nth(2).locator('pre')
  assert(await wide.evaluate(pre => pre.scrollWidth > pre.clientWidth), 'Wide code must have its own scroll range')
  await wide.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => wide.evaluate(pre => pre.scrollLeft)).toBeGreaterThan(0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.equal(await blocks.locator('pre[node]').count(), 0, 'Markdown node metadata never becomes a DOM attribute')
  if (shots) {
    await blocks.nth(0).evaluate(block => {
      const header = document.querySelector('[data-blog-root] > header'), guide = document.querySelector('[data-testid="voyage-reading-guide"]')
      scrollTo({ top: block.getBoundingClientRect().top + scrollY - header.getBoundingClientRect().height - guide.getBoundingClientRect().height - 24, behavior: 'instant' })
    })
    await blocks.nth(0).screenshot({ path: `${shots}/code-320-${mode}.png` })
  }
})

test('Voyage copies the exact displayed code by keyboard without replacing headings', async t => {
  const { page } = await session(t, { width: 1440 })
  const block = page.getByTestId('voyage-code-block').first()
  const code = await block.locator('code').textContent()
  assert(code.includes('\tconst message = "你好, " + name\n'))
  assert(code.includes('}\n\nconsole.log'))
  await page.evaluate(() => { window.__headingBeforeCopy = document.querySelector('[data-voyage-prose] h2') })
  await block.getByRole('button', { name: 'Copy code' }).focus()
  await page.keyboard.press('Enter')
  await expect(block.getByRole('status')).toHaveText('Code copied.')
  assert.deepEqual(await page.evaluate(() => window.__copiedCode), [code])
  assert(await page.evaluate(() => window.__headingBeforeCopy === document.querySelector('[data-voyage-prose] h2')))
  assert.match(await page.locator('[data-voyage-prose] h2').first().getAttribute('id'), /^voyage-.*-section-1$/)
  const plain = page.getByTestId('voyage-code-block').nth(2)
  await plain.getByRole('button', { name: 'Copy code' }).click()
  assert.equal((await page.evaluate(() => window.__copiedCode)).at(-1), await plain.locator('code').textContent())
})

test('Voyage copy failures stay explicit and retryable in Chinese', async t => {
  const { page } = await session(t, { locale: 'zh', clipboard: 'failure' })
  const block = page.getByTestId('voyage-code-block').first()
  await block.getByRole('button', { name: '复制代码' }).click()
  await expect(block.getByRole('status')).toHaveText('复制失败，可选中文字手动复制。')
  await expect(block.getByRole('button', { name: '重试复制' })).toBeEnabled()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.evaluate(() => { navigator.clipboard.writeText = async value => { window.__copiedCode.push(value) } })
  await block.getByRole('button', { name: '重试复制' }).click()
  await expect(block.getByRole('status')).toHaveText('代码已复制。')
  assert.equal((await page.evaluate(() => window.__copiedCode)).length, 1)
})

test('Other themes keep the original pre/code structure when switching appearances', async t => {
  const { page } = await session(t)
  const code = await page.getByTestId('voyage-code-block').first().locator('code').textContent()
  const setDesign = async design => page.evaluate(design => {
    const key = 'ark.design.v1', oldValue = localStorage.getItem(key)
    localStorage.setItem(key, design)
    dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: design, storageArea: localStorage }))
  }, design)
  await setDesign('archive')
  await expect(page.getByTestId('voyage-code-block')).toHaveCount(0)
  await expect(page.locator('[data-voyage-prose] > pre > code')).toHaveCount(4)
  assert.equal(await page.locator('[data-voyage-prose] > pre > code').first().textContent(), code)
  assert.equal(await page.locator('[data-voyage-prose] pre[node]').count(), 0)
  await setDesign('voyage')
  await expect(page.getByTestId('voyage-code-block')).toHaveCount(4)
  await expect(page.getByTestId('voyage-code-block').first().getByRole('button', { name: 'Copy code' })).toBeEnabled()
})
