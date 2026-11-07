import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
for (const width of [320, 1440]) for (const mode of ['light', 'dark']) {
  test(`Voyage renders one homepage and usable navigation: ${width}px ${mode}`, async t => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    t.after(() => context.close())
    await context.addInitScript(mode => {
      localStorage.setItem('ark.design.v1', 'voyage')
      localStorage.setItem('ark.theme', mode)
      localStorage.setItem('ark.locale', 'zh')
      localStorage.setItem('ark.mascot:v1', 'off')
    }, mode)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${baseURL}/home`)
    await expect(page.getByTestId('voyage-home')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('夜航')
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme), mode)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.locator('[data-menu-toggle]').click()
    const menu = page.getByTestId('voyage-menu')
    await expect(menu).toBeVisible()
    await menu.locator('nav a').first().focus()
    await page.keyboard.press('End')
    await expect(menu.locator('nav a').last()).toBeFocused()
    await page.keyboard.press('Home')
    await expect(menu.locator('nav a').first()).toBeFocused()
    await menu.locator('nav a[href="/articles"]').click()
    await expect(menu).toHaveCount(0)
    await expect(page).toHaveURL(`${baseURL}/articles`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
  })
}

for (const locale of ['en', 'ja', 'de']) {
  test(`Voyage narrow-screen typography preserves the full title: ${locale}`, async t => {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' })
    t.after(() => context.close())
    await context.addInitScript(locale => {
      localStorage.setItem('ark.design.v1', 'voyage')
      localStorage.setItem('ark.theme', 'light')
      localStorage.setItem('ark.locale', locale)
      localStorage.setItem('ark.mascot:v1', 'off')
    }, locale)
    const page = await context.newPage()
    await page.goto(`${baseURL}/home`)
    await expect(page.getByTestId('voyage-home')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const words = await page.locator('#voyage-title b').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect()
      return { left: r.left, right: r.right, viewport: innerWidth }
    }))
    assert(words.every(word => word.left >= 0 && word.right <= word.viewport), 'Title words must not be cropped by the hero')
    await page.locator('[data-menu-toggle]').click()
    const menu = page.getByTestId('voyage-menu')
    await expect(menu).toBeVisible()
    assert.equal(await menu.evaluate(el => el.scrollWidth > el.clientWidth), false)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
  })
}

for (const width of [320, 1440]) {
  test(`Voyage atlas previews real destinations without navigation or refetch: ${width}px`, async t => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    t.after(() => context.close())
    await context.addInitScript(() => {
      localStorage.setItem('ark.design.v1', 'voyage')
      localStorage.setItem('ark.theme', 'light')
      localStorage.setItem('ark.locale', 'zh')
      localStorage.setItem('ark.mascot:v1', 'off')
    })
    const page = await context.newPage()
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/\/api\/blog\/(knowledge|moments)/.test(request.url())) requests.push(request.url()) })
    await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('heading')).toHaveText('A small record of time')
    const before = requests.length
    await page.getByTestId('voyage-stop-0').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('voyage-stop-1')).toBeFocused()
    await expect(page.getByTestId('voyage-stop-1')).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('heading')).toHaveText('October, a beginning')
    await expect(panel.getByRole('link', { name: '打开这一页' })).toHaveAttribute('href', '/moments/bbbbbbbbbbbbbbbbbbbbbbbb')
    await page.keyboard.press('End')
    await expect(panel.getByRole('link', { name: '打开这一页' })).toHaveAttribute('href', '/moments/bbbbbbbbbbbbbbbbbbbbbbbb')
    await page.keyboard.press('Home')
    if (width === 320) {
      await panel.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 260, clientY: 300 })
      await panel.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, clientX: 90, clientY: 310 })
      await expect(panel.getByRole('heading')).toHaveText('October, a beginning')
      assert.match(await panel.evaluate(el => getComputedStyle(el).touchAction), /pinch-zoom/)
    }
    await expect(page).toHaveURL(`${baseURL}/home`)
    assert.equal(requests.length, before, 'Choosing a coordinate reuses the loaded content')
    await panel.getByRole('link', { name: '打开这一页' }).click()
    await expect(page).toHaveURL(new RegExp(width === 320 ? '/moments/b{24}$' : '/articles/a{24}$'))
    assert.deepEqual(errors, [])
  })
}

for (const width of [320, 650]) {
  test(`Voyage long-title preview stays above its controls: ${width}px`, async t => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    t.after(() => context.close())
    await context.addInitScript(() => {
      localStorage.setItem('ark.design.v1', 'voyage')
      localStorage.setItem('ark.theme', 'dark')
      localStorage.setItem('ark.locale', 'en')
      localStorage.setItem('ark.mascot:v1', 'off')
    })
    const title = 'A voyage through the many quiet pages and distant places we have not yet learned how to remember'
    await context.route('**/api/blog/knowledge?limit=4', route => route.fulfill({ json: {
      success: true, data: [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title, content: 'A long-title layout fixture.', category: 'DISPATCH', createdAt: '2026-10-01T12:00:00Z', username: 'Tester', uid: 'test-admin', tags: [] }],
    } }))
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); return document.fonts.ready })
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('heading')).toHaveText(title)
    const open = await panel.getByRole('link', { name: 'Open this page' }).boundingBox()
    const next = await page.getByRole('button', { name: 'Next record', exact: true }).boundingBox()
    assert(open && next && open.y + open.height <= next.y, 'Long content must not overlap route controls')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
  })
}

for (const width of [320, 1440]) {
  test(`Voyage motion retargets without duplicate interactive content: ${width}px`, async t => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' })
    t.after(() => context.close())
    await context.addInitScript(() => {
      localStorage.setItem('ark.design.v1', 'voyage')
      localStorage.setItem('ark.theme', 'dark')
      localStorage.setItem('ark.locale', 'zh')
      localStorage.setItem('ark.mascot:v1', 'off')
    })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
    const marker = page.getByTestId('voyage-route-beacon')
    const panel = page.getByRole('tabpanel')
    await page.getByTestId('voyage-stop-0').focus()
    await page.keyboard.press('End')
    const endpoints = await page.getByRole('tablist').evaluate(el => {
      const surface = el.querySelector('svg').getBoundingClientRect()
      return [...el.querySelectorAll('button > span:first-child')].map(point => { const r = point.getBoundingClientRect(); return { x: (r.x + r.width / 2 - surface.x) / surface.width, y: (r.y + r.height / 2 - surface.y) / surface.height } })
    })
    const samples = await marker.evaluate(el => new Promise(resolve => {
      const start = performance.now(), samples = []
      const surface = el.parentElement.getBoundingClientRect()
      const sample = now => {
        const r = el.getBoundingClientRect()
        samples.push({ x: (r.x + r.width / 2 - surface.x) / surface.width, y: (r.y + r.height / 2 - surface.y) / surface.height, moving: el.dataset.travelling })
        if (now - start < 210) requestAnimationFrame(sample)
        else resolve(samples)
      }
      requestAnimationFrame(sample)
    }))
    assert(samples.filter(sample => sample.moving === 'true').length >= 3)
    assert(samples.at(-1).x > samples[0].x, 'The beacon travels rather than snapping')
    const [first, last] = [endpoints[0], endpoints.at(-1)]
    assert(samples.some(sample => Math.abs(sample.y - (first.y + (sample.x - first.x) / (last.x - first.x) * (last.y - first.y))) > .025), 'A trip follows the actual curved route rather than a straight shortcut')
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('voyage-stop-1')).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('heading')).toHaveCount(1)
    await expect(panel.getByRole('heading')).toHaveText('October, a beginning')
    await expect(panel.getByRole('link', { name: '打开这一页' })).toHaveCount(1)
    await expect(panel.locator('[data-preview-layer="outgoing"]')).toHaveCount(0)
    await expect(marker).toHaveAttribute('data-travelling', 'false')
    const point = await page.getByTestId('voyage-stop-1').locator('span').first().boundingBox()
    const landed = await marker.boundingBox()
    assert(point && landed && Math.hypot(point.x + point.width / 2 - landed.x - landed.width / 2, point.y + point.height / 2 - landed.y - landed.height / 2) < 1.5, 'The travelling beacon lands on the actual clickable station')
    await page.keyboard.press('End')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(marker).toHaveAttribute('data-travelling', 'false')
    await expect(panel.getByRole('link', { name: '打开这一页' })).toHaveAttribute('href', '/moments/bbbbbbbbbbbbbbbbbbbbbbbb')
    assert.deepEqual(errors, [])
  })
}
