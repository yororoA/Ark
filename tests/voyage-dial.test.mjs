import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

// ARK_VERIFY_PORT=10570 node scripts/verify-blog.mjs --serve
// TEST_BASE_URL=http://127.0.0.1:10570 node --test tests/voyage-dial.test.mjs
// Touch tests use Chrome's native input pipeline, not dispatched pointer events.
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10570'
const dateAt = index => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - 83 + index)
  return date.toISOString().slice(0, 10)
}
const activeDates = [0, 21, 42, 63, 83].map(dateAt)
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function session(t, { width = 1440, mode = 'light', reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
    hasTouch: width === 390, isMobile: width === 390, colorScheme: mode, reducedMotion,
  })
  t.after(() => context.close())
  await context.addInitScript(mode => {
    localStorage.setItem('ark.design.v1', 'voyage')
    localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, mode)
  const requests = []
  await context.route('**/api/blog/moments/summary?*', route => route.fulfill({ json: { data: { entries: [], activeDates } } }))
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'GET' && /\/api\/blog\/(moments|knowledge|github)(\/|\?|$)/.test(request.url())) requests.push(request.url())
  })
  t.after(() => assert.deepEqual(errors, [], 'The dial does not produce browser errors'))
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  const dial = page.getByTestId('voyage-dial-control')
  await expect(dial).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const refreshed = page.waitForResponse(response => response.url().includes('/api/blog/moments/summary?'))
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await refreshed
  await expect(page.getByTestId('calendar-overview').locator('g[data-date][data-active="true"]')).toHaveCount(activeDates.length)
  // Keep the complete interaction ring between the fixed header and phone dock.
  await page.getByTestId('calendar-overview').evaluate(element => {
    const top = element.getBoundingClientRect().top + scrollY - 130
    scrollTo({ top, behavior: 'instant' })
  })
  const ring = dial.locator('..')
  const before = [...requests]
  t.after(() => assert.deepEqual(requests, before, 'Dial interaction never refetches content or code statistics'))
  return { context, page, dial, ring }
}

async function point(dial, index, radius = 195) {
  return dial.evaluate((element, { index, radius }) => {
    const rect = element.ownerSVGElement.getBoundingClientRect()
    const angle = index / 84 * Math.PI * 2
    return { x: rect.left + rect.width / 2 + Math.sin(angle) * rect.width * radius / 520,
      y: rect.top + rect.height / 2 - Math.cos(angle) * rect.height * radius / 520 }
  }, { index, radius })
}

async function selected(page, dial, index) {
  await expect(dial).toHaveAttribute('aria-valuenow', String(index + 1))
  await expect(page.getByTestId('activity-calendar').locator(`button[data-date="${dateAt(index)}"]`)).toHaveAttribute('aria-pressed', 'true')
  await expect(dial).toHaveAttribute('aria-valuetext', /公开片刻/)
  if ([0, 21, 42, 63, 83].includes(index)) await expect(page.getByTestId('calendar-open')).toHaveAttribute('href', `/moments?date=${dateAt(index)}`)
}

async function mousePoint(page, dial, index) {
  const { x, y } = await point(dial, index)
  await page.mouse.move(x, y)
}

async function nativeTouch(cdp, type, position) {
  await cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: position ? [{ id: 1, x: position.x, y: position.y, radiusX: 5, radiusY: 5, force: 1 }] : [],
  })
}

test('Voyage dial mouse drag selects real dates and wraps across the top of the scale', async t => {
  const { page, dial, ring } = await session(t)
  await mousePoint(page, dial, 21)
  await page.mouse.down()
  await expect(ring).toHaveAttribute('data-dragging', 'true')
  await selected(page, dial, 21)
  for (const index of [28, 35, 42]) await mousePoint(page, dial, index)
  await page.mouse.up()
  await selected(page, dial, 42)
  await expect(ring).toHaveAttribute('data-dragging', 'false')
  await mousePoint(page, dial, 83)
  await page.mouse.down()
  await selected(page, dial, 83)
  await mousePoint(page, dial, 0)
  await page.mouse.up()
  await selected(page, dial, 0)
  await expect(page).toHaveURL(`${baseURL}/home`)
})

test('Voyage dial exposes an accessible keyboard slider and synchronizes the week controls', async t => {
  const { page, dial } = await session(t, { mode: 'dark' })
  await expect(page.getByRole('slider', { name: '航迹盘，选择日期' })).toHaveCount(1)
  await expect(dial).toHaveAttribute('aria-valuemin', '1')
  await expect(dial).toHaveAttribute('aria-valuemax', '84')
  await dial.focus()
  for (const [key, index] of [['End', 83], ['ArrowRight', 83], ['Home', 0], ['ArrowLeft', 0], ['ArrowRight', 1], ['ArrowUp', 8], ['ArrowDown', 1]]) {
    await page.keyboard.press(key)
    await selected(page, dial, index)
    await expect(dial).toBeFocused()
  }
  await expect.poll(() => dial.evaluate(element => {
    const orbit = element.ownerSVGElement.querySelector('[class*="focusOrbit"]')
    return getComputedStyle(orbit).stroke
  })).not.toBe('rgba(0, 0, 0, 0)')
})

test('Voyage phone dial accepts native touch drag without scrolling the page', async t => {
  const { context, page, dial, ring } = await session(t, { width: 390, mode: 'dark' })
  const cdp = await context.newCDPSession(page)
  const scroll = await page.evaluate(() => scrollY)
  await nativeTouch(cdp, 'touchStart', await point(dial, 21))
  await expect(ring).toHaveAttribute('data-dragging', 'true')
  for (const index of [25, 30, 35, 42]) await nativeTouch(cdp, 'touchMove', await point(dial, index))
  await nativeTouch(cdp, 'touchEnd')
  await selected(page, dial, 42)
  await expect(ring).toHaveAttribute('data-dragging', 'false')
  assert(Math.abs(await page.evaluate(() => scrollY) - scroll) <= 2, 'Touching the ring owns the gesture instead of panning the page')
})

test('Voyage phone dial center preserves native page scrolling and does not change the date', async t => {
  const { context, page, dial, ring } = await session(t, { width: 390 })
  const cdp = await context.newCDPSession(page)
  const before = await dial.getAttribute('aria-valuenow')
  const scroll = await page.evaluate(() => scrollY)
  const center = await point(dial, 0, 0)
  await nativeTouch(cdp, 'touchStart', { x: center.x, y: center.y + 60 })
  for (const offset of [35, 10, -15, -40, -70]) await nativeTouch(cdp, 'touchMove', { x: center.x, y: center.y + offset })
  await nativeTouch(cdp, 'touchEnd')
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 30)
  await expect(dial).toHaveAttribute('aria-valuenow', before)
  await expect(ring).toHaveAttribute('data-dragging', 'false')
})

test('Voyage native touch cancellation releases the dial and a new drag still works', async t => {
  const { context, page, dial, ring } = await session(t, { width: 390, mode: 'dark' })
  const cdp = await context.newCDPSession(page)
  await nativeTouch(cdp, 'touchStart', await point(dial, 21))
  await nativeTouch(cdp, 'touchMove', await point(dial, 30))
  await expect(dial).toHaveAttribute('aria-valuenow', '31')
  await nativeTouch(cdp, 'touchCancel')
  await expect(ring).toHaveAttribute('data-dragging', 'false')
  const cancelledValue = await dial.getAttribute('aria-valuenow')
  await mousePoint(page, dial, 63)
  await expect(dial).toHaveAttribute('aria-valuenow', cancelledValue)
  await nativeTouch(cdp, 'touchStart', await point(dial, 42))
  await nativeTouch(cdp, 'touchEnd')
  await selected(page, dial, 42)
  await expect(ring).toHaveAttribute('data-dragging', 'false')
})

test('Voyage reduced-motion dial updates immediately and recovers from lost pointer capture', async t => {
  const { page, dial, ring } = await session(t, { reducedMotion: 'reduce' })
  await expect(page.getByTestId('voyage-dial-needle')).toHaveCSS('transition-duration', '0s')
  await dial.evaluate(element => element.addEventListener('gotpointercapture', event => { element.dataset.capturedPointer = String(event.pointerId) }))
  await mousePoint(page, dial, 21)
  await page.mouse.down()
  await mousePoint(page, dial, 28)
  await selected(page, dial, 28)
  await dial.evaluate(element => element.releasePointerCapture(Number(element.dataset.capturedPointer)))
  // Browsers process a pending capture change before the next native pointer
  // event, rather than synchronously inside releasePointerCapture().
  await mousePoint(page, dial, 42)
  await expect(ring).toHaveAttribute('data-dragging', 'false')
  await page.mouse.up()
  await selected(page, dial, 28)
  await page.mouse.down()
  await page.mouse.up()
  await selected(page, dial, 42)
})
