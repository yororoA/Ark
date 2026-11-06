import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { createLocalVideo, galleryFiles, showGallery } from './fixtures/voyage-gallery.mjs'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const artifacts = process.env.CONTINUITY_ARTIFACTS
let browser, video
before(async () => {
  browser = await chromium.launch({ headless: true })
  video = await createLocalVideo(browser)
  if (artifacts) await mkdir(artifacts, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, { width = 1440, height = 900, motion = 'no-preference', design = 'voyage', nativeVideo = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion })
  const files = galleryFiles(baseURL)
  await context.addInitScript(({ design, files }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': design, 'ark.theme': 'light', 'ark.locale': 'en', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
    // Only the JSON list is local fixture data. Static images use actual HTTP
    // and normal browser caching; Playwright routing disables that cache.
    const fetch = window.fetch
    window.fetch = function (input, ...args) {
      if (String(input instanceof Request ? input.url : input).includes('/api/blog/gallery/get?')) return Promise.resolve(new Response(JSON.stringify({ data: { files, count: files.length, hasMore: false, breakpoint: null } }), { headers: { 'Content-Type': 'application/json' } }))
      return fetch.call(this, input, ...args)
    }
    window.__mediaFlights = []
    const animate = Element.prototype.animate
    // Observe native animation geometry and time without altering its duration,
    // frames or scheduling. This also catches dev Strict Mode consuming entry.
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      if (!this.hasAttribute('data-voyage-media-flight')) return animation
      const rect = element => element.getBoundingClientRect().toJSON()
      const dialog = this.closest('dialog'), image = dialog.querySelector('img')
      const record = { start: performance.now(), duration: animation.effect.getTiming().duration,
        from: rect(this), to: rect(image), parent: this.parentElement.tagName,
        dialogOpen: dialog.open && dialog.matches(':modal'), pointerEvents: getComputedStyle(this).pointerEvents,
        background: getComputedStyle(this).backgroundColor, samples: [] }
      window.__mediaFlights.push(record)
      const sample = () => {
        if (!this.isConnected) return
        record.samples.push({ elapsed: performance.now() - record.start, box: rect(this), state: animation.playState })
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
      animation.finished.then(() => {
        record.end = performance.now(); record.final = rect(this)
        requestAnimationFrame(() => { record.cleaned = !this.isConnected; record.visibility = getComputedStyle(image).visibility })
      }, () => { record.cancelled = performance.now() })
      return animation
    }
  }, { design, files: nativeVideo ? files : files.filter(file => !file.mime.startsWith('video')) })
  if (nativeVideo) await context.route('**/contact-sheet-fixture.webm', route => route.fulfill({ body: video, contentType: 'video/webm' }))
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  t.after(async () => { await context.close(); assert.deepEqual(errors, []) })
  await showGallery(page, baseURL)
  return { page, context, files }
}

async function openFrame(page, description, { awaitFlight = true } = {}) {
  const opener = page.getByRole('button', { name: `Preview ${description}`, exact: true })
  await opener.scrollIntoViewIfNeeded()
  const image = opener.locator('img')
  if (await image.count()) await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
  const count = await page.evaluate(() => window.__mediaFlights.length)
  const source = await image.count() ? await image.boundingBox() : undefined
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  if (awaitFlight) await page.waitForFunction(count => window.__mediaFlights.length > count, count)
  return { opener, dialog, source, count }
}

for (const width of [1440, 390]) {
  test(`The selected photograph travels from its own frame to the full viewer in 300ms: ${width}px`, async t => {
    const { page, files } = await session(t, { width })
    const { dialog, source, opener } = await openFrame(page, files[2].desc)
    if (artifacts) await page.screenshot({ path: `${artifacts}/entry-${width}-middle.png` })
    await expect.poll(() => page.evaluate(() => window.__mediaFlights[0]?.cleaned)).toBe(true)
    const record = await page.evaluate(() => window.__mediaFlights[0])
    assert.equal(record.dialogOpen, true, 'Native modality and its controls are available before the visual bridge starts')
    assert.equal(record.duration, 300)
    assert.equal(record.parent, 'DIALOG')
    assert.equal(record.pointerEvents, 'none')
    for (const [key, sourceKey] of [['left', 'x'], ['top', 'y'], ['width', 'width'], ['height', 'height']]) assert(Math.abs(record.from[key] - source[sourceKey]) < 2, `The first frame matches thumbnail ${key}`)
    for (const key of ['left', 'top', 'width', 'height']) assert(Math.abs(record.final[key] - record.to[key]) < 1, `The final frame matches full-size image ${key}`)
    assert(record.samples.some(sample => sample.elapsed > 70 && sample.elapsed < 230 && Math.abs(sample.box.width - record.from.width) > 1 && Math.abs(sample.box.width - record.to.width) > 1), 'A genuine intermediate geometry connects the two sizes')
    assert(record.end - record.start < 500, 'The bridge introduces no extra hold after its 300ms travel')
    assert.equal(record.visibility, 'visible')
    await expect(dialog.locator('[data-voyage-media-flight]')).toHaveCount(0)
    await expect(dialog.locator('output')).toHaveText('100%')
    assert.equal(await dialog.locator('img').evaluate(image => getComputedStyle(image).animationName), 'none', 'The completed travel is not followed by a second entrance fade')
    if (artifacts) {
      await page.screenshot({ path: `${artifacts}/entry-${width}-complete.png` })
      await writeFile(`${artifacts}/entry-${width}.json`, JSON.stringify({ source, record }, null, 2))
    }
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
  })
}

test('Keyboard, wheel, drag and close immediately take over from the travelling photograph', async t => {
  const { page, files } = await session(t)
  for (const input of ['keyboard', 'wheel', 'drag', 'next', 'close']) {
    const { dialog, opener, count } = await openFrame(page, files[2].desc)
    const stage = dialog.locator('[data-media-preview-stage]')
    const started = await page.evaluate(index => window.__mediaFlights[index].start, count)
    if (input === 'keyboard') await page.keyboard.press('+')
    if (input === 'wheel') {
      const box = await stage.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.wheel(0, -110)
    }
    if (input === 'drag') {
      const box = await stage.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 50, y + 25); await page.mouse.up()
    }
    if (input === 'next') await page.keyboard.press('ArrowRight')
    if (input === 'close') await page.keyboard.press('Escape')
    await expect(page.locator('[data-voyage-media-flight]')).toHaveCount(0)
    const cancelled = await page.evaluate(index => window.__mediaFlights[index].cancelled, count)
    assert(cancelled && cancelled - started < 300, `${input} interrupts rather than waiting for the 300ms animation`)
    if (input === 'keyboard' || input === 'wheel') await expect(dialog.locator('output')).toHaveText('125%')
    if (input === 'drag') assert.notEqual(await dialog.locator('[data-media-preview-canvas]').evaluate(element => getComputedStyle(element).transform), 'matrix(1, 0, 0, 1, 0, 0)')
    if (input === 'next') {
      await expect(dialog.getByRole('heading')).toHaveText(files[4].desc)
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(340)
      assert.equal(await page.evaluate(() => window.__mediaFlights.length), count + 1, 'Changing back to the first image does not reuse a stale thumbnail origin')
    }
    if (input !== 'close') {
      assert.equal(await dialog.locator('img').evaluate(image => getComputedStyle(image).visibility), 'visible')
      await page.keyboard.press('Escape')
    }
    await expect(opener).toBeFocused()
  }
})

test('Resize and a new reduced-motion preference cancel the bridge without hiding the image', async t => {
  const { page, files } = await session(t)
  for (const action of ['resize', 'reduce']) {
    const { dialog, count } = await openFrame(page, files[2].desc)
    if (action === 'resize') await page.setViewportSize({ width: 1280, height: 760 })
    else await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(dialog.locator('[data-voyage-media-flight]')).toHaveCount(0)
    assert(await page.evaluate(index => !!window.__mediaFlights[index].cancelled, count))
    assert.equal(await dialog.locator('img').evaluate(image => getComputedStyle(image).visibility), 'visible')
    await page.keyboard.press('Escape')
  }
})

test('Transparent artwork keeps the same neutral backing in the frame, moving copy and viewer', async t => {
  const { page, files } = await session(t)
  const { dialog } = await openFrame(page, files[4].desc)
  const record = await page.evaluate(() => window.__mediaFlights[0])
  assert.equal(record.background, 'rgb(115, 119, 127)', 'The transparent flying image has an opaque neutral backing below its original pixels')
  const backing = await dialog.locator('img').evaluate(image => getComputedStyle(image).backgroundColor)
  assert.equal(backing, record.background)
  await expect.poll(() => page.evaluate(() => window.__mediaFlights[0].cleaned)).toBe(true)
  if (artifacts) await page.screenshot({ path: `${artifacts}/transparent-complete.png` })
})

test('Reduced motion, native video and other themes never create a travelling copy', async t => {
  for (const [motion, design, type] of [['reduce', 'voyage', 'image'], ['no-preference', 'voyage', 'video'], ['no-preference', 'archive', 'image']]) {
    const { page, files } = await session(t, { motion, design, nativeVideo: type === 'video' })
    const { dialog } = await openFrame(page, files[type === 'video' ? 3 : 2].desc, { awaitFlight: false })
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => window.__mediaFlights.length), 0)
    if (type === 'video') {
      await expect(dialog.locator('video')).toHaveAttribute('controls', '')
      await expect.poll(() => dialog.locator('video').evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2)
    } else assert.equal(await dialog.locator('img').evaluate(image => getComputedStyle(image).visibility), 'visible')
    await page.keyboard.press('Escape')
  }
})

test('A loaded thumbnail with a delayed viewer response never starts a late spatial entrance', async t => {
  const { page, context } = await session(t)
  let requests = 0, release
  const gate = new Promise(resolve => { release = resolve })
  const imageURL = `${baseURL}/continuity-delayed.svg`
  const description = 'The viewer response arrives later'
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><path fill="#1849bc" d="M0 0h640v400H0z"/><circle fill="#eef992" cx="320" cy="200" r="60"/></svg>'
  // Routing here intentionally disables cache so the mounted viewer receives
  // a separate delayed response even though the selected thumbnail is loaded.
  await context.route('**/continuity-delayed.svg', async route => {
    if (++requests > 1) await gate
    await route.fulfill({ body: svg, contentType: 'image/svg+xml' })
  })
  await context.addInitScript(({ imageURL, description }) => {
    const fetch = window.fetch
    window.fetch = function (input, ...args) {
      if (String(input instanceof Request ? input.url : input).includes('/api/blog/gallery/get?')) return Promise.resolve(new Response(JSON.stringify({ data: { files: [{ filename: 'late.svg', url: imageURL, mime: 'image/svg+xml', desc: description }], count: 1 } }), { headers: { 'Content-Type': 'application/json' } }))
      return fetch.call(this, input, ...args)
    }
  }, { imageURL, description })
  t.after(() => release())
  await showGallery(page, baseURL)
  const { dialog } = await openFrame(page, description, { awaitFlight: false })
  await expect.poll(() => requests).toBe(2)
  await page.waitForTimeout(400)
  const image = dialog.locator('img')
  assert.equal(await image.evaluate(element => element.complete), false)
  assert.equal(await image.evaluate(element => getComputedStyle(element).visibility), 'visible', 'A pending network response does not leave the real image hidden')
  assert.equal(await page.evaluate(() => window.__mediaFlights.length), 0)
  release()
  await expect(image).toHaveAttribute('data-media-ready', 'true')
  await page.waitForTimeout(350)
  assert.equal(await page.evaluate(() => window.__mediaFlights.length), 0, 'The image is not made to travel from an old thumbnail after the wait')
  await expect(dialog.locator('[data-voyage-media-flight]')).toHaveCount(0)
  await page.keyboard.press('Escape')
})
