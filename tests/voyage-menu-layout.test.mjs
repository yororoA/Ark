import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Use an isolated fixture, not a live account. The 720×450 @2 case represents
// the CSS viewport available when a 1440×900 desktop page is zoomed to 200%.
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const shots = process.env.MENU_SCREENSHOT_DIR
let browser
before(async () => {
  browser = await chromium.launch({ headless: true })
  if (shots) await mkdir(shots, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, { width, height, locale = 'zh', scale = 1, mode = 'light' }) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale,
    hasTouch: width <= 640, reducedMotion: 'reduce', colorScheme: mode,
  })
  t.after(() => context.close())
  await context.addInitScript(({ locale, mode }) => {
    localStorage.setItem('ark.design.v1', 'voyage')
    localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', locale)
    localStorage.setItem('ark.mascot:v1', 'off')
  }, { locale, mode })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'The menu must not produce browser errors'))
  page.setDefaultTimeout(12000)
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return page
}

const cases = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'reported-desktop', width: 1347, height: 821 },
  { name: 'desktop-720-height', width: 1280, height: 720 },
  { name: 'wide-short-desktop', width: 1920, height: 700 },
  { name: 'short-desktop', width: 1280, height: 600 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'small-phone-german', width: 320, height: 568, locale: 'de' },
  { name: 'text-200-percent-german', width: 1280, height: 720, locale: 'de', textScale: 2 },
  { name: 'landscape-german', width: 844, height: 390, locale: 'de' },
  { name: 'desktop-200-percent-german', width: 720, height: 450, scale: 2, locale: 'de' },
]
for (const dimensions of cases) {
  test(`Voyage menu footer follows all destinations: ${dimensions.name}`, async t => {
    const page = await session(t, dimensions)
    const toggle = page.locator('[data-menu-toggle]')
    await toggle.click()
    const menu = page.getByTestId('voyage-menu')
    await expect(menu).toBeVisible()
    if (dimensions.textScale) await menu.evaluate((dialog, scale) => {
      const elements = [dialog, ...dialog.querySelectorAll('*')]
      const sizes = elements.map(element => parseFloat(getComputedStyle(element).fontSize))
      elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * scale}px` })
    }, dimensions.textScale)
    await expect(menu.locator('nav > svg')).toHaveAttribute('data-ready', 'true')
    const layout = await menu.evaluate(dialog => {
      const nav = dialog.querySelector('nav'), footer = dialog.querySelector('footer')
      const destinations = [...nav.querySelectorAll('a')]
      return {
        destinationCount: destinations.length,
        navigationBottom: nav.getBoundingClientRect().bottom,
        lastDestinationBottom: Math.max(...destinations.map(link => link.getBoundingClientRect().bottom)),
        footerTop: footer.getBoundingClientRect().top,
        horizontalOverflow: dialog.scrollWidth > dialog.clientWidth,
        clipped: [nav, nav.parentElement, nav.parentElement.parentElement].some(element => ['hidden', 'clip'].includes(getComputedStyle(element).overflowY)),
      }
    })
    assert.equal(layout.destinationCount, 8)
    assert(layout.navigationBottom >= layout.lastDestinationBottom - 1, 'The navigation box must contain its last row')
    assert(layout.footerTop >= layout.lastDestinationBottom + 15, `Footer must follow the whole navigation with clear space: ${JSON.stringify(layout)}`)
    assert.equal(layout.horizontalOverflow, false)
    assert.equal(layout.clipped, false, 'Content must scroll instead of being hidden to prevent overlap')
    const footerLinks = menu.locator('footer a')
    for (const link of await footerLinks.all()) {
      await link.scrollIntoViewIfNeeded()
      const reachable = await link.evaluate(element => {
        const r = element.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
        const hit = document.elementFromPoint(x, y)
        return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 && (hit === element || element.contains(hit))
      })
      assert(reachable, 'Every footer action must scroll fully into view and receive clicks')
    }
    if (shots) await page.screenshot({ path: `${shots}/menu-${dimensions.name}.png` })
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(toggle).toBeFocused()
    await toggle.click()
    await menu.locator('footer a[href^="/theme"]').click()
    await expect(page.getByTestId('theme-page')).toBeVisible()
    const url = new URL(page.url())
    assert.equal(url.pathname, '/theme')
    assert.equal(url.searchParams.get('returnTo'), '/home')
  })
}

for (const mode of ['light', 'dark']) {
  test(`Voyage menu trigger hover keeps its transparent surface: ${mode}`, async t => {
    const page = await session(t, { width: 1440, height: 900, mode })
    const toggle = page.locator('[data-menu-toggle]')
    const header = page.locator('header[class*="site-header"]')
    const initialHeader = await header.evaluate(element => getComputedStyle(element).backgroundColor)
    await toggle.hover()
    await expect.poll(() => toggle.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    assert.equal(await header.evaluate(element => getComputedStyle(element).backgroundColor), initialHeader)
    assert.equal(await page.getByTestId('voyage-menu').count(), 0, 'Hover must not open or recolor the full menu')
  })
}
