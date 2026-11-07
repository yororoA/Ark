import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
async function session(t, design, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(design => {
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, design)
  const login = await context.request.post(`${baseURL}/api/auth/login`, { data: { username: 'expansion-fixture', password: 'fixture-password' } })
  assert.equal(login.status(), 200, 'Run only against the isolated preview fixture')
  await context.route('**/api/blog/sse/subscribe', route => route.fulfill({ contentType: 'text/event-stream', body: 'retry: 600000\n: fixture\n\n' }))
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  return page
}
for (const design of ['allotype', 'fold', 'voyage']) for (const width of [1440, 2048]) {
  test(`expanded chat fills viewport without theme gutters: ${design} ${width}`, async t => {
    const page = await session(t, design, width)
    await page.goto(`${baseURL}/chat`)
    await page.getByRole('button', { name: '放大聊天界面', exact: true }).click()
    const expanded = page.locator('[data-expanded="true"]')
    await expect(expanded).toBeVisible()
    const box = await expanded.evaluate(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el)
      return { left: r.left, right: r.right, bottom: r.bottom, padding: s.padding, top: r.top, header: document.querySelector('header').getBoundingClientRect().bottom }
    })
    assert.equal(box.left, 0); assert.equal(box.right, width); assert.equal(box.bottom, 1000)
    assert.equal(box.padding, '0px'); assert.equal(box.top, box.header)
    await expect(page.locator('form[class*="chat-compose"]')).toBeVisible()
    if (process.env.TEST_SCREENSHOTS) {
      await mkdir(process.env.TEST_SCREENSHOTS, { recursive: true })
      await page.screenshot({ path: `${process.env.TEST_SCREENSHOTS}/${design}-${width}.png` })
    }
    await page.getByRole('button', { name: '还原聊天界面', exact: true }).click()
    await expect(page.locator('[data-expanded="false"]')).toBeVisible()
  })
}
test('returning to gallery reuses data beyond the old five-second dedupe window', async t => {
  const page = await session(t, 'fold', 1440)
  await page.route('**/api/blog/gallery/get?*', route => route.fulfill({ json: { data: { files: [{ filename: 'cached.png', url: `${baseURL}/login_light.png`, mime: 'image/png' }], count: 1, hasMore: false } } }))
  let requests = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/blog/gallery/get') requests++ })
  await page.goto(`${baseURL}/gallery`)
  await expect(page.locator('main figure').first()).toBeVisible()
  const initial = requests
  assert(initial > 0)
  await page.locator('header nav a[href="/about"]').click()
  await expect(page).toHaveURL(`${baseURL}/about`)
  await page.waitForTimeout(6000)
  await page.locator('header nav a[href="/gallery"]').click()
  await expect(page.locator('main figure').first()).toBeVisible()
  assert.equal(requests, initial, 'A brief revisit must reuse the cached media response')
})
