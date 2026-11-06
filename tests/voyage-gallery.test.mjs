import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const artifacts = process.env.GALLERY_ARTIFACTS
const description = 'A quiet evening by the shore, with enough room for every part of the photograph'
let browser, video
before(async () => {
  browser = await chromium.launch({ headless: true })
  if (artifacts) await mkdir(artifacts, { recursive: true })
  const page = await browser.newPage()
  // A real, local playable clip keeps verification independent of remote media.
  video = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 160; canvas.height = 90
    const drawing = canvas.getContext('2d'), stream = canvas.captureStream(10)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const stopped = new Promise(resolve => { recorder.onstop = resolve })
    recorder.start()
    for (let frame = 0; frame < 12; frame++) {
      drawing.fillStyle = '#080f26'; drawing.fillRect(0, 0, 160, 90)
      drawing.fillStyle = '#e6ff62'; drawing.fillRect(frame * 10, 40, 20, 2)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop())
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    return btoa(String.fromCharCode(...bytes))
  }), 'base64')
  await page.close()
})
after(async () => { await browser?.close() })

async function session(t, { width = 1440, height = 900, motion = 'reduce', longTitle = false, record = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion,
    recordVideo: record && artifacts ? { dir: artifacts, size: { width, height } } : undefined })
  await context.addInitScript(() => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': 'voyage', 'ark.theme': 'light', 'ark.locale': 'en', 'ark.mascot:v1': 'off' })) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    }
  })
  const files = [
    { filename: 'evening.jpg', url: `${baseURL}/404.jpeg`, mime: 'image/jpeg', desc: longTitle ? description.repeat(5) : description, username: 'The author', createdAt: '2026-11-06T00:00:00Z' },
    { filename: 'motion.webm', url: `${baseURL}/gallery-craft-fixture.webm`, mime: 'video/webm', desc: 'A line travelling across the water', username: 'The author', createdAt: '2026-11-05T00:00:00Z' },
    { filename: 'portrait.png', url: `${baseURL}/login_dark.png`, mime: 'image/png', desc: 'A portrait kept in the archive', username: 'The author', createdAt: '2026-11-04T00:00:00Z' },
  ]
  await context.route('**/gallery-craft-fixture.webm', route => route.fulfill({ body: video, contentType: 'video/webm' }))
  await context.route('**/api/blog/gallery/get?*', route => route.fulfill({ json: { data: { files, count: files.length, hasMore: false, breakpoint: null } } }))
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(async () => {
    await context.close()
    if (record && artifacts) {
      await page.video().saveAs(`${artifacts}/gallery-motion.webm`)
      await page.video().delete()
    }
    assert.deepEqual(errors, [])
  })
  page.setDefaultTimeout(12000)
  await page.goto(`${baseURL}/gallery`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return { page, first: files[0].desc }
}

async function fits(dialog, width, height) {
  const measurements = await dialog.evaluate(element => {
    const r = element.getBoundingClientRect(), stage = element.querySelector('[data-media-preview-stage]').getBoundingClientRect()
    return {
      left: r.left, right: r.right, top: r.top, bottom: r.bottom, stageHeight: stage.height,
      overflow: element.scrollWidth > element.clientWidth,
      controls: [...element.querySelectorAll('button')].map(button => {
        const box = button.getBoundingClientRect()
        return { width: box.width, height: box.height, top: box.top, bottom: box.bottom, left: box.left, right: box.right }
      }),
    }
  })
  assert(measurements.left >= -1 && measurements.right <= width + 1 && measurements.top >= -1 && measurements.bottom <= height + 1)
  assert.equal(measurements.overflow, false)
  assert(measurements.stageHeight >= 76)
  assert(measurements.controls.every(box => box.width >= 44 && box.height >= 44 && box.top >= -1 && box.bottom <= height + 1 && box.left >= -1 && box.right <= width + 1), 'Every viewer control has a reachable 44px target')
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 400 }, { width: 844, height: 390 }]) {
  test(`Voyage gallery fits images, video, long descriptions and controls: ${viewport.width}×${viewport.height}`, async t => {
    const { page, first } = await session(t, { ...viewport, longTitle: true })
    const opener = page.getByRole('button', { name: `Preview ${first}`, exact: true })
    await expect(page.locator('figcaption').first()).toContainText(first)
    await opener.click()
    const dialog = page.getByRole('dialog'), image = dialog.locator('img')
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
    await fits(dialog, viewport.width, viewport.height)
    const uncropped = await image.evaluate(element => {
      const image = element.getBoundingClientRect(), stage = element.closest('[data-media-preview-stage]').getBoundingClientRect()
      return image.left >= stage.left - 1 && image.right <= stage.right + 1 && image.top >= stage.top - 1 && image.bottom <= stage.bottom + 1
        && Math.abs(image.width / image.height - element.naturalWidth / element.naturalHeight) < .01
    })
    assert(uncropped, 'The whole photograph fits with its original aspect ratio')
    assert.equal(await image.evaluate(element => getComputedStyle(element).animationName), 'none')
    if (artifacts) await page.screenshot({ path: `${artifacts}/gallery-${viewport.width}x${viewport.height}.png` })
    await page.keyboard.press('ArrowRight')
    await expect(dialog.locator('video')).toHaveAttribute('controls', '')
    await expect(dialog.locator('video')).toHaveAttribute('playsinline', '')
    await expect.poll(() => dialog.locator('video').evaluate(element => element.videoWidth)).toBe(160)
    await fits(dialog, viewport.width, viewport.height)
    await expect(dialog.locator('[data-media-preview-zoom]')).toHaveCount(0)
    await page.keyboard.press('ArrowRight')
    await expect(dialog.locator('output')).toHaveText('100%')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('Voyage gallery fade leaves zoom, pan, reset and keyboard navigation intact', async t => {
  const { page, first } = await session(t, { motion: 'no-preference', record: true })
  const opener = page.getByRole('button', { name: `Preview ${first}`, exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog'), stage = dialog.locator('[data-media-preview-stage]')
  await expect.poll(() => dialog.locator('img').evaluate(element => element.complete)).toBe(true)
  await page.waitForTimeout(350)
  if (artifacts) await page.screenshot({ path: `${artifacts}/gallery-desktop.png` })
  await page.keyboard.press('+')
  await expect(dialog.locator('output')).toHaveText('125%')
  const box = await stage.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 62, y + 34, { steps: 8 }); await page.mouse.up()
  const canvas = dialog.locator('[data-media-preview-canvas]')
  assert.notEqual(await canvas.evaluate(element => getComputedStyle(element).transform), 'matrix(1, 0, 0, 1, 0, 0)')
  await page.keyboard.press('0')
  await expect(dialog.locator('output')).toHaveText('100%')
  await expect.poll(() => canvas.evaluate(element => getComputedStyle(element).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)')
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => dialog.locator('video').evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2)
  await dialog.locator('video').evaluate(element => { element.currentTime = 0; return element.play() })
  await page.waitForTimeout(500)
  assert(await dialog.locator('video').evaluate(element => element.currentTime > .1))
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.waitForTimeout(350)
  assert.equal(await dialog.locator('img').evaluate(element => getComputedStyle(element).transform), 'matrix(1, 0, 0, 1, 0, 0)')
  await expect.poll(() => dialog.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0)
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await dialog.locator('img').evaluate(element => getComputedStyle(element).animationName), 'none')
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('Voyage gallery treatment stays isolated when switching to other themes', async t => {
  const { page, first } = await session(t)
  for (const design of ['archive', 'rain', 'p3r', 'prism', 'allotype', 'fold', 'voyage']) {
    await page.goto(`${baseURL}/theme?returnTo=%2Fgallery`, { waitUntil: 'networkidle' })
    const option = page.locator(`input[type="radio"][value="${design}"]`)
    await option.focus()
    await page.keyboard.press('Space')
    await expect(option).toBeChecked()
    await page.getByRole('link', { name: 'Continue browsing', exact: true }).click()
    const caption = page.locator('figcaption').first()
    await expect(caption).toContainText(design === 'voyage' ? first : 'The author')
    if (design !== 'voyage') await expect(caption).not.toContainText(first)
    await page.getByRole('button', { name: `Preview ${first}`, exact: true }).click()
    const background = await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor)
    assert.equal(background === 'rgb(8, 15, 38)', design === 'voyage')
    await page.keyboard.press('Escape')
  }
})

test('Voyage gallery fades only after delayed images load and isolates late, broken and reduced-motion arrivals', async t => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  const names = ['initial', 'delayed', 'stale', 'current', 'broken', 'reduced']
  const files = names.map((name, index) => ({
    filename: `${name}.svg`, url: `${baseURL}/gallery-arrival-${name}.svg`, mime: 'image/svg+xml',
    desc: `${name} photograph`, createdAt: `2026-11-0${6 - index}T00:00:00Z`,
  }))
  const gates = new Map(), pending = new Set()
  for (const name of names.slice(1)) {
    let release
    const ready = new Promise(resolve => { release = resolve })
    gates.set(name, { ready, release })
  }
  await context.addInitScript(() => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': 'voyage', 'ark.theme': 'light', 'ark.locale': 'en', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
    window.__galleryArrival = { loads: [], starts: [], samples: [] }
    document.addEventListener('load', event => {
      if (event.target.matches?.('dialog img')) window.__galleryArrival.loads.push({ src: event.target.src, at: performance.now() })
    }, true)
    document.addEventListener('animationstart', event => {
      if (!event.target.matches?.('dialog img') || !event.animationName.includes('image-arrive')) return
      const image = event.target
      const animation = image.getAnimations().find(item => item.animationName?.includes('image-arrive'))
      window.__galleryArrival.starts.push({ src: image.src, at: performance.now(), duration: animation?.effect.getTiming().duration })
      // Sample during the actual 200ms animation, rather than racing an assertion
      // against a load event from Node or accepting an animation that already ended.
      setTimeout(() => window.__galleryArrival.samples.push({
        src: image.src, state: animation?.playState, opacity: Number(getComputedStyle(image).opacity),
      }), 50)
    }, true)
  })
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><path fill="#233451" d="M0 0h640v400H0z"/><circle fill="#e6ff62" cx="320" cy="200" r="60"/></svg>'
  await context.route('**/gallery-arrival-*.svg', route => {
    const name = new URL(route.request().url()).pathname.match(/gallery-arrival-(.+)\.svg$/)[1]
    const task = (async () => {
      await gates.get(name)?.ready
      await route.fulfill(name === 'broken'
        ? { status: 404, body: 'Missing photograph', contentType: 'text/plain' }
        : { body: svg, contentType: 'image/svg+xml', headers: { 'Cache-Control': 'no-store' } })
    })()
    pending.add(task)
    task.finally(() => pending.delete(task))
    return task
  })
  await context.route('**/api/blog/gallery/get?*', route => route.fulfill({ json: { data: { files, count: files.length, hasMore: false, breakpoint: null } } }))
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  t.after(async () => {
    for (const gate of gates.values()) gate.release()
    await Promise.allSettled(pending)
    await context.close()
    assert.deepEqual(errors, [])
  })
  // Thumbnails may share these pending requests, so do not wait for networkidle
  // or fulfill them until the viewer's selected image has been checked.
  await page.goto(`${baseURL}/gallery`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Preview initial photograph', exact: true }).click()
  const dialog = page.getByRole('dialog'), image = dialog.locator('img')
  await expect(image).toHaveAttribute('data-media-ready', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(image).toHaveAttribute('src', files[1].url)
  const mounted = await page.evaluate(() => performance.now())
  await page.waitForTimeout(800)
  assert.equal(await image.evaluate(element => element.complete), false)
  await expect(image).not.toHaveAttribute('data-media-ready', 'true')
  assert.equal(await image.evaluate(element => getComputedStyle(element).animationName), 'none', 'Mounting an unloaded image does not consume its fade')
  gates.get('delayed').release()
  await expect(image).toHaveAttribute('data-media-ready', 'true')
  await expect.poll(() => page.evaluate(src => window.__galleryArrival.samples.find(item => item.src === src), files[1].url)).toBeTruthy()
  const arrival = await page.evaluate(src => ({
    load: window.__galleryArrival.loads.find(item => item.src === src),
    start: window.__galleryArrival.starts.find(item => item.src === src),
    sample: window.__galleryArrival.samples.find(item => item.src === src),
  }), files[1].url)
  assert(arrival.load.at - mounted >= 750, 'The image really remained unloaded for approximately 800ms')
  assert(arrival.start.at >= arrival.load.at, 'The fade begins after the actual image load')
  assert.equal(arrival.start.duration, 200)
  assert.equal(arrival.sample.state, 'running')
  assert(arrival.sample.opacity > .6 && arrival.sample.opacity < 1, 'The loaded image visibly fades in')
  await expect.poll(() => image.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running'))).toBe(false)
  await expect(image).toHaveCSS('opacity', '1')

  await page.keyboard.press('ArrowRight')
  await expect(image).toHaveAttribute('src', files[2].url)
  const oldImage = await image.elementHandle()
  await page.keyboard.press('ArrowRight')
  await expect(image).toHaveAttribute('src', files[3].url)
  gates.get('stale').release()
  await expect.poll(() => oldImage.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
  await expect(image).not.toHaveAttribute('data-media-ready', 'true')
  assert.equal(await image.evaluate(element => element.complete), false, 'A late previous image cannot mark the current image as loaded')
  assert.equal(await image.evaluate(element => getComputedStyle(element).animationName), 'none')
  gates.get('current').release()
  await expect(image).toHaveAttribute('data-media-ready', 'true')

  await page.keyboard.press('ArrowRight')
  await expect(image).toHaveAttribute('src', files[4].url)
  gates.get('broken').release()
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth === 0)).toBe(true)
  await expect(image).toHaveAttribute('alt', 'broken photograph')
  await expect(image).not.toHaveAttribute('data-media-ready', 'true')
  await expect(image).toHaveCSS('opacity', '1')
  await expect(image).toHaveCSS('visibility', 'visible')
  await expect(image).toBeVisible()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.keyboard.press('ArrowRight')
  await expect(image).toHaveAttribute('src', files[5].url)
  gates.get('reduced').release()
  await expect(image).toHaveAttribute('data-media-ready', 'true')
  assert.equal(await image.evaluate(element => getComputedStyle(element).animationName), 'none')
  assert.equal(await image.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running')), false)
  await expect(image).toHaveCSS('opacity', '1')
})
