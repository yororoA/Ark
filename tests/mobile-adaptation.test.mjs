import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const designs = ['archive', 'rain', 'p3r', 'prism']
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
let browser

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, design, viewport, { locale = 'zh', reducedMotion = 'reduce' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion })
  t.after(() => context.close())
  await context.addInitScript(({ design, locale }) => {
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.locale', locale)
  }, { design, locale })
  const response = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { username: 'mobile-regression', password: 'fixture-password' },
  })
  assert.equal(response.status(), 200, 'Run against the isolated verify:blog:preview fixture')
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { context, page }
}

async function visit(page, route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' })
  await page.locator('h1:visible').first().waitFor()
  if (route !== '/login') await page.locator('[class*="account-links"] > span').waitFor({ state: 'attached' })
}

async function fitsViewport(locator, viewport, message) {
  const box = await locator.boundingBox()
  assert(box && box.x >= -1 && box.x + box.width <= viewport.width + 1, `${message}: horizontal bounds`)
  assert(box.y >= -1 && box.y + box.height <= viewport.height + 1, `${message}: vertical bounds`)
}

for (const design of designs) {
  for (const viewport of viewports) {
    test(`mobile navigation: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport)
      await visit(page, '/articles')
      await fitsViewport(page.locator('[class*="site-header"]'), viewport, 'Header')
      const appearance = page.getByRole('button', { name: '外观', exact: true })
      await appearance.tap()
      const panel = page.locator('[class*="theme-panel"]')
      await expect(panel).toBeVisible()
      await fitsViewport(panel, viewport, 'Appearance panel')
      await page.getByRole('button', { name: '关闭外观设置' }).tap()
      await expect(panel).toHaveCount(0)
      const opener = page.getByRole('button', { name: '打开导航', exact: true })
      if (!await opener.isVisible()) {
        assert(viewport.width > 820, 'Phone navigation must be available')
        return
      }
      await opener.tap()
      const dialog = page.locator('dialog[open]')
      await expect(dialog).toBeVisible()
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      const nav = dialog.locator('nav')
      const links = nav.locator('a')
      assert.equal(await links.count(), 8, 'Every destination is available')
      for (const link of await links.all()) {
        await link.scrollIntoViewIfNeeded()
        await fitsViewport(link, viewport, await link.textContent())
      }
      await dialog.getByRole('button', { name: '关闭', exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      await expect(opener).toBeFocused()
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await opener.tap()
      await page.keyboard.press('Escape')
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      await opener.tap()
      await page.locator('dialog[open] nav a[href="/moments"]').tap()
      await expect(page).toHaveURL(`${baseURL}/moments`)
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    })
  }
}
