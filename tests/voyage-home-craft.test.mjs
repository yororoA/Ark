import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function session(t, { width = 1440, mode = 'light', motion = 'reduce' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion, colorScheme: mode })
  t.after(() => context.close())
  await context.addInitScript(mode => {
    localStorage.setItem('ark.design.v1', 'voyage')
    localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', 'en')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, mode)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  page.setDefaultTimeout(12000)
  return { page, context }
}

for (const width of [320, 390, 650]) for (const mode of ['light', 'dark']) {
  test(`Voyage mobile image has its own space and long titles remain complete: ${width}px ${mode}`, async t => {
    const { page, context } = await session(t, { width, mode })
    const title = 'A voyage through the many quiet pages and distant places we have not yet learned how to remember'
    await context.route('**/api/blog/knowledge?limit=4', route => route.fulfill({ json: { success: true, data: [{
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title, content: `![An archive image](${baseURL}/404.jpeg)\n\nThe words remain outside the image and keep their own space.`,
      category: 'LOGBOOK', createdAt: '2026-10-01T12:00:00Z', tags: [], uid: 'test-admin', username: 'Tester',
    }] } }))
    await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
    await page.evaluate(() => { dispatchEvent(new Event('online')); return document.fonts.ready })
    const panel = page.getByRole('tabpanel'), heading = panel.getByRole('heading')
    await expect(heading).toHaveText(title)
    const geometry = await panel.evaluate(element => {
      const current = element.querySelector('[data-preview-layer="current"]')
      const image = current.querySelector('img').parentElement.getBoundingClientRect()
      const text = current.querySelector('h2'), title = text.getBoundingClientRect()
      const open = [...current.querySelectorAll('a')].at(-1).getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(text)
      const lines = [...range.getClientRects()]
      return {
        imageBottom: image.bottom, imageHeight: image.height, titleTop: title.top,
        completeTitle: getComputedStyle(text).webkitLineClamp === 'none'
          && lines.every(line => line.bottom < open.top && line.left >= -1 && line.right <= innerWidth + 1),
        openBottom: open.bottom, panelBottom: element.getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }
    })
    assert(geometry.imageHeight >= 150, 'The cover remains a useful image rather than a faint text backdrop')
    assert(geometry.titleTop > geometry.imageBottom, 'The mobile headline must not overlap the cover')
    assert(geometry.completeTitle, 'A long title may grow the page instead of being clipped')
    assert(geometry.openBottom <= geometry.panelBottom + 1, 'The open action must remain in the panel flow')
    assert.equal(geometry.overflow, false)
    await expect(page.getByTestId('home-activity')).toHaveCount(1)
  })
}

test('Voyage rapid preview changes remain readable and leave one interactive record', async t => {
  const { page } = await session(t, { motion: 'no-preference' })
  const requests = []
  page.on('request', request => { if (/\/api\/blog\/(knowledge|moments)/.test(request.url())) requests.push(request.url()) })
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1000)
  const before = requests.length, panel = page.getByRole('tabpanel')
  await page.getByTestId('voyage-stop-0').focus()
  for (const key of ['ArrowRight', 'End', 'Home', 'ArrowRight', 'ArrowRight']) {
    await page.keyboard.press(key)
    const layers = await panel.evaluate(element => {
      const current = element.querySelector('[data-preview-layer="current"]')
      const ghost = element.querySelector('[data-preview-layer="outgoing"]')
      return {
        opacity: Number(getComputedStyle(current.querySelector('h2')).opacity),
        ghosts: element.querySelectorAll('[data-preview-layer="outgoing"]').length,
        inert: !ghost || (ghost.inert && ghost.getAttribute('aria-hidden') === 'true'),
      }
    })
    assert(layers.opacity >= .34, 'Rapid changes must not restart the headline from an invisible frame')
    assert(layers.ghosts <= 1 && layers.inert, 'Only the current preview can be focused or announced')
    await page.waitForTimeout(45)
  }
  await expect(panel.getByRole('heading')).toHaveText('Where the light falls.')
  await expect(panel.getByRole('link', { name: 'Open this page' })).toHaveCount(1)
  await expect(panel.locator('[data-preview-layer="outgoing"]')).toHaveCount(0)
  await expect(page.getByTestId('voyage-route-beacon')).toHaveAttribute('data-travelling', 'false')
  await expect.poll(() => panel.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0)
  assert.equal(requests.length, before)
})

test('Voyage reduced-motion changes settle preview and section entrances immediately', async t => {
  const { page } = await session(t, { motion: 'no-preference', width: 390, mode: 'dark' })
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  await page.getByTestId('voyage-stop-0').focus()
  await page.keyboard.press('End')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByTestId('voyage-route-beacon')).toHaveAttribute('data-travelling', 'false')
  const heading = page.getByRole('tabpanel').getByRole('heading')
  await expect(heading).toHaveText('Back through time.')
  assert.equal(await heading.evaluate(element => getComputedStyle(element).animationName), 'none')
  const logbook = page.locator('#voyage-logbook')
  await logbook.scrollIntoViewIfNeeded()
  const visible = await logbook.locator('h2').evaluate(element => {
    for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      if (Number(getComputedStyle(ancestor).opacity) < 1) return false
    }
    return true
  })
  assert(visible, 'Enabling reduced motion reveals a section even if its entrance has not started')
})
