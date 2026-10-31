import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, webkit, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const screenshots = process.env.MOBILE_SCREENSHOT_DIR
let browser
before(async () => { browser = await (process.env.TEST_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true }) })
after(async () => { await browser?.close() })
async function session(t, design = 'archive', width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 640, hasTouch: width <= 640, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(design => {
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, design)
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { page, context }
}
async function visit(page, path) {
  await page.goto(baseURL + path)
  await page.locator('main h1').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
}

for (const design of ['archive', 'rain', 'p3r', 'prism']) {
  test(`app navigation and keyboard: ${design}`, async t => {
    const { page } = await session(t, design)
    await visit(page, '/articles')
    const nav = page.getByRole('navigation', { name: '主导航', exact: true })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: '文章', exact: true })).toHaveAttribute('aria-current', 'page')
    const box = await nav.boundingBox()
    assert.equal(Math.round(box.y + box.height), 844)
    for (const item of await nav.locator('a,button').all()) {
      const box = await item.boundingBox()
      assert(box.width >= 44 && box.height >= 44)
    }
    const more = nav.getByRole('button', { name: '更多', exact: true })
    await more.tap()
    await expect(page.locator('dialog[open]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(more).toBeFocused()
    const search = page.getByRole('searchbox', { name: '搜索文章' })
    await search.tap()
    await expect(nav).toBeHidden()
    await search.press('Enter')
    await expect(nav).toBeVisible()
    if (screenshots) await page.screenshot({ path: `${screenshots}/${design}-articles.png` })
    await nav.getByRole('link', { name: '片刻', exact: true }).tap()
    await expect(page).toHaveURL(/\/moments$/)
    await expect(nav.getByRole('link', { name: '片刻', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    const footerButton = page.locator('footer').getByRole('button', { name: '回到顶部' })
    const footerBox = await footerButton.boundingBox()
    assert(footerBox.y + footerBox.height <= (await nav.boundingBox()).y, 'Last footer control is above navigation')
    await page.setViewportSize({ width: 320, height: 568 })
    await expect(nav).toBeVisible()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    await page.setViewportSize({ width: 640, height: 844 })
    await expect(nav).toBeVisible()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 640)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(nav).toBeHidden()
    if (design === 'p3r') await expect(page.locator('[data-menu-toggle]')).toBeVisible()
    else await expect(page.locator('[class*="desktop-nav"]')).toBeVisible()
    if (screenshots) await page.screenshot({ path: `${screenshots}/${design}-desktop.png` })
  })
}

test('reading return, browser history and search state', async t => {
  const { page } = await session(t)
  await visit(page, '/articles?category=Development')
  const card = page.locator('main a[href^="/articles/"][href*="returnTo="]').first()
  await card.scrollIntoViewIfNeeded()
  const y = await page.evaluate(() => scrollY)
  assert(y > 0, 'Start from a scrolled list')
  await card.tap()
  await expect(page).toHaveURL(/\/articles\/a+\?returnTo=/)
  await page.getByRole('link', { name: '返回 · 文章', exact: true }).tap()
  await expect(page).toHaveURL(/\/articles\?category=Development$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y)
  await card.tap()
  await expect(page).toHaveURL(/\/articles\/a+\?returnTo=/)
  await page.goBack()
  await expect(page).toHaveURL(/\/articles\?category=Development$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y)
  const search = page.getByRole('searchbox', { name: '搜索文章' })
  await search.fill('first')
  await search.press('Enter')
  await expect(page).toHaveURL(/keyword=first/)
  await search.fill('second')
  await search.press('Enter')
  await expect(page).toHaveURL(/keyword=second/)
  await page.goBack()
  await expect(search).toHaveValue('first')
  await page.goForward()
  await expect(search).toHaveValue('second')
})

for (const mode of ['success', 'cancel', 'fallback', 'denied', 'manual']) {
  test(`share content: ${mode}`, async t => {
    const { page, context } = await session(t)
    await context.addInitScript(mode => {
      window.shared = null
      window.copied = null
      Object.defineProperty(navigator, 'share', { configurable: true, value: ['fallback', 'manual'].includes(mode) ? undefined : async data => {
        window.shared = data
        if (mode === 'denied') throw new DOMException('Denied', 'NotAllowedError')
        if (mode === 'cancel') throw new DOMException('Cancelled', 'AbortError')
      } })
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { if (mode === 'manual') throw new DOMException('Denied', 'NotAllowedError'); window.copied = text } } })
    }, mode)
    await visit(page, '/articles/aaaaaaaaaaaaaaaaaaaaaaaa?returnTo=%2Farticles%3Fcategory%3DDevelopment#read')
    await page.getByRole('button', { name: '分享', exact: true }).click()
    if (mode === 'manual') {
      await expect(page.locator('[data-blog-root] > [role="status"]')).toContainText(`${baseURL}/articles/aaaaaaaaaaaaaaaaaaaaaaaa`)
    } else if (mode === 'fallback' || mode === 'denied') {
      await expect.poll(() => page.evaluate(() => window.copied)).toBe(`${baseURL}/articles/aaaaaaaaaaaaaaaaaaaaaaaa`)
      await expect(page.getByRole('status')).toContainText('已复制')
    } else {
      assert.equal((await page.evaluate(() => window.shared)).url, `${baseURL}/articles/aaaaaaaaaaaaaaaaaaaaaaaa`)
      assert.equal((await page.evaluate(() => window.shared)).title, 'A small record of time')
      assert.equal(await page.evaluate(() => window.copied), null)
      await expect(page.locator('[data-blog-root] > [role="status"]')).toHaveCount(0)
    }
  })
}

 test('moment return and share', async t => {
  const { page, context } = await session(t)
  await context.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.shared = data } }) })
  await visit(page, '/moments?date=2026-10-01')
  const card = page.locator('main a[href^="/moments/bbbbbbbbbbbbbbbbbbbbbbbb"]')
  await card.scrollIntoViewIfNeeded()
  const y = await page.evaluate(() => scrollY)
  await card.tap()
  await expect(page).toHaveURL(/\/moments\/b+\?returnTo=/)
  await page.getByRole('button', { name: '分享', exact: true }).click()
  assert.equal((await page.evaluate(() => window.shared)).url, `${baseURL}/moments/bbbbbbbbbbbbbbbbbbbbbbbb`)
  await page.getByRole('link', { name: '返回 · 片刻', exact: true }).tap()
  await expect(page).toHaveURL(/\/moments\?date=2026-10-01$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y)
  await card.tap()
  await expect(page).toHaveURL(/\/moments\/b+\?returnTo=/)
  await page.goBack()
  await expect(page).toHaveURL(/\/moments\?date=2026-10-01$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y)
})
