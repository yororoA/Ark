import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10580'
if (!/^http:\/\/127\.0\.0\.1:(10580|10590)$/.test(baseURL)) throw new Error('Poster checks require an isolated local preview')
const artifacts = process.env.ARK_LAB_POSTER_ARTIFACTS
let browser
before(async () => { browser = await chromium.launch({ headless: true }); if (artifacts) await mkdir(artifacts, { recursive: true }) })
after(async () => browser?.close())

async function session(t, { width = 1440, height = 1000, mode = 'light', locale = 'zh', motion = 'reduce', path = '/lab', touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: mode, reducedMotion: motion, hasTouch: touch })
  t.after(() => context.close())
  await context.addInitScript(({ mode, locale }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': 'voyage', 'ark.theme': mode, 'ark.locale': locale, 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
  }, { mode, locale })
  const writes = [], errors = []
  await context.route('**/api/**', route => {
    const request = route.request()
    if (new URL(request.url()).pathname === '/api/session') return route.fulfill({ json: new URL(request.url()).searchParams.has('all') ? { data: [], activeUid: null } : { data: null } })
    if (request.method() !== 'GET') { writes.push(request.url()); return route.fulfill({ json: { data: {} } }) }
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(writes, []) })
  await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' })
  const poster = page.getByTestId('voyage-lab-poster'), slider = poster.getByRole('slider'), speed = page.getByTestId('voyage-lab-speed')
  return { context, page, poster, slider, speed }
}

async function sample(slider, value) {
  await slider.evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

async function checkPoint(page, value) {
  const point = await page.getByTestId('voyage-lab-point').evaluate(element => {
    const point = element.getBoundingClientRect(), plot = element.parentElement.getBoundingClientRect()
    return { x: (point.x + point.width / 2 - plot.x) / plot.width, y: (point.y + point.height / 2 - plot.y) / plot.height, width: point.width, height: point.height }
  })
  assert.ok(Math.abs(point.x - value / 1000) < .002)
  assert.ok(Math.abs(point.y - (1 - Math.sin(4 * Math.PI * value / 1000)) / 2) < .002)
  assert.equal(point.width, point.height, 'Sampling marker stays circular when the graph changes aspect ratio')
}

test('The sample, speed, highlighted path and marker agree with the actual initial function', async t => {
  const { page, poster, slider, speed } = await session(t)
  await expect(slider).toHaveValue('625')
  for (const value of [0, 125, 375, 625, 875, 1000]) {
    await sample(slider, value)
    await expect(speed).toHaveText(`${(2 + Math.sin(4 * Math.PI * value / 1000)).toFixed(2)}×`)
    await expect(poster.locator('clipPath rect')).toHaveAttribute('width', String(value))
    await checkPoint(page, value)
  }
  await slider.focus()
  await slider.press('Home')
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('5')
  await expect(slider).toHaveAttribute('aria-valuetext', '时长比例 0.005 · 2.06×')
  await slider.press('End')
  await expect(slider).toHaveValue('1000')
  assert.equal(await poster.locator('output[aria-live="off"]').count(), 2)
  assert.equal(await page.locator('button[aria-controls="lab-workspace"]').count(), 1)
  assert.equal(await poster.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0)
})

test('A real menu navigation reveals the route before drawing the sample, then becomes still', async t => {
  const { page } = await session(t, { path: '/articles', motion: 'no-preference' })
  await page.locator('[data-menu-toggle]').click()
  const menu = page.getByTestId('voyage-menu')
  await expect(menu).toBeVisible()
  await page.evaluate(() => {
    window.labFrames = []; window.recordLab = true
    const frame = () => {
      if (!window.recordLab) return
      const poster = document.querySelector('[data-testid="voyage-lab-poster"]')
      if (poster) window.labFrames.push({ phase: document.documentElement.dataset.voyageWipe || 'idle', drawing: poster.dataset.drawing, value: Number(poster.querySelector('input').value) })
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  await menu.locator('a[href="/lab"]').click()
  await expect(page).toHaveURL(`${baseURL}/lab`)
  const poster = page.getByTestId('voyage-lab-poster')
  await expect.poll(async () => page.evaluate(() => window.labFrames.some(frame => frame.drawing === 'true'))).toBe(true)
  await expect(poster).toHaveAttribute('data-drawing', 'false')
  await expect(poster.getByRole('slider')).toHaveValue('625')
  await page.waitForTimeout(200)
  const frames = await page.evaluate(() => { window.recordLab = false; return window.labFrames })
  assert.ok(frames.some(frame => frame.phase !== 'idle'), 'The test exercised a real route curtain')
  assert.ok(frames.filter(frame => frame.drawing === 'true').length > 5)
  assert.ok(frames.filter(frame => frame.drawing === 'true').every(frame => frame.phase === 'idle'))
  assert.ok(frames.filter(frame => frame.phase !== 'idle').every(frame => frame.drawing === 'false'))
  assert.ok(frames.find(frame => frame.drawing === 'true').value <= 20, 'The visible drawing starts at the origin rather than a partly completed curve')
  assert.ok(frames.slice(-5).every(frame => frame.drawing === 'false' && frame.value === 625))
  if (artifacts) await page.screenshot({ path: `${artifacts}/lab-menu-arrival.png`, fullPage: true })
})

test('The plot waits below the page fold, settles offscreen, and never resets a later sample', async t => {
  const { page, poster, slider, context } = await session(t, { width: 320, height: 568, motion: 'no-preference' })
  await expect(slider).toHaveValue('0')
  await expect(poster).toHaveAttribute('data-drawing', 'false')
  await page.waitForTimeout(200)
  await expect(slider).toHaveValue('0')
  await slider.scrollIntoViewIfNeeded()
  await expect(poster).toHaveAttribute('data-drawing', 'true')
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await expect(poster).toHaveAttribute('data-drawing', 'false')
  await expect(slider).toHaveValue('625')
  await sample(slider, 375)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await slider.scrollIntoViewIfNeeded()
  await expect(slider).toHaveValue('375')
  await expect(page.getByTestId('voyage-lab-speed')).toHaveText('1.00×')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(200)
  await expect(slider).toHaveValue('375')
  assert.equal(context.pages().length, 1)
})

test('Touch samples use a native range while vertical touch movement continues scrolling', async t => {
  const { page, slider } = await session(t, { width: 390, height: 844, touch: true })
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  await slider.tap({ position: { x: box.width * .25, y: box.height / 2 } })
  const value = Number(await slider.inputValue())
  assert.ok(value > 200 && value < 300)
  await checkPoint(page, value)
  assert.equal(await slider.evaluate(element => getComputedStyle(element).touchAction), 'pan-y')
  const client = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2, y = box.y + box.height / 2, before = await page.evaluate(() => scrollY)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 100 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 30)
})

for (const config of [
  { width: 1440, height: 1000, mode: 'light', locale: 'zh' },
  { width: 1440, height: 1000, mode: 'dark', locale: 'en' },
  { width: 390, height: 844, mode: 'light', locale: 'zh' },
  { width: 320, height: 780, mode: 'dark', locale: 'de' },
  { width: 844, height: 390, mode: 'dark', locale: 'ja' },
]) test(`Poster typography and controls remain readable: ${config.width}×${config.height} ${config.mode} ${config.locale}`, async t => {
  const { page, poster, slider, speed } = await session(t, config)
  await page.evaluate(() => document.fonts.ready)
  await expect(poster).toBeVisible()
  await expect(slider).toHaveValue('625')
  await expect(speed).toHaveText(`${config.locale === 'de' ? '3,00' : '3.00'}×`)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  const overflow = await poster.evaluate(element => [...element.querySelectorAll('h2,p,button,label,output')].filter(child => child.scrollWidth > child.clientWidth + 1).map(child => child.textContent))
  assert.deepEqual(overflow, [])
  await slider.scrollIntoViewIfNeeded()
  await checkPoint(page, 625)
  if (artifacts) {
    await page.screenshot({ path: `${artifacts}/lab-controls-${config.width}-${config.mode}-${config.locale}.png` })
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `${artifacts}/lab-${config.width}-${config.mode}-${config.locale}.png`, fullPage: true })
  }
})
