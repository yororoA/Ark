import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const { chromium, webkit, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const engine = process.env.TEST_BROWSER === 'webkit' ? 'webkit' : 'chromium'
const evidenceDirectory = process.env.MOBILE_SCREENSHOT_DIR
let browser

before(async () => {
  browser = await (engine === 'webkit' ? webkit : chromium).launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
  if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, viewport) {
  const context = await browser.newContext({
    // Reproduce resizing a desktop browser's responsive viewport, not a phone
    // device or a software keyboard. Both menu entries still follow CSS width.
    viewport, deviceScaleFactor: 1, hasTouch: false,
    isMobile: false, reducedMotion: 'no-preference',
  })
  t.after(() => context.close())
  await context.addInitScript(() => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    localStorage.setItem('ark.design.v1', 'p3r')
    localStorage.setItem('ark.locale', 'en')
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.mascot:v1', 'off')
    // Retain the two WAAPI clips before their fill:none animations disappear
    // from getAnimations(). Pause only these clips at creation; the test then
    // captures and pauses every animation within the open dialog.
    window.__menuClipAnimations = []
    window.__menuHeldAnimations = []
    window.__menuDrainAnimations = []
    window.__menuHoldDrain = false
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      if (this.closest('dialog') && /(?:menu-surface|menu-rim)/.test(this.className)) {
        if (animation.effect.getTiming().fill === 'none') {
          animation.pause()
          animation.currentTime = 0
          window.__menuClipAnimations.push(animation)
        } else if (window.__menuHoldDrain) {
          animation.pause()
          animation.currentTime = 0
          window.__menuDrainAnimations.push(animation)
        }
      }
      return animation
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  await page.goto(`${baseURL}/about`)
  await page.locator('h1:visible').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('[class*="account-links"]').waitFor({ state: 'attached' })
  return page
}

function opener(page, entry) {
  return entry === 'more'
    ? page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('button', { name: 'More', exact: true })
    : page.locator('[data-menu-toggle]')
}

async function openAndHold(page, entry) {
  await opener(page, entry).click()
  await expect(page.locator('dialog[open]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__menuClipAnimations.filter(animation => animation.playState !== 'idle' && animation.effect.target.isConnected).length)).toBe(2)
  return page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')
    // Development Strict Mode may have already cancelled the first effect's
    // pair. Keep the live opening pair, then retain it beyond its endpoint.
    window.__menuClipAnimations = window.__menuClipAnimations.filter(animation => animation.playState !== 'idle' && animation.effect.target.isConnected)
    window.__menuHeldAnimations = [...new Set([
      ...window.__menuClipAnimations, ...dialog.getAnimations({ subtree: true }),
    ])]
    return window.__menuHeldAnimations.map(animation => {
      animation.pause()
      animation.currentTime = 0
      const timing = animation.effect.getTiming()
      return {
        target: animation.effect.target.className,
        duration: timing.duration, delay: timing.delay,
        iterations: Number.isFinite(timing.iterations) ? timing.iterations : 'infinite',
      }
    })
  })
}

async function frame(page, milliseconds) {
  return page.evaluate(async milliseconds => {
    const dialog = document.querySelector('dialog[open]')
    // Include any CSS animations introduced by the new viewport, but never
    // lose previously held finite animations after their active interval.
    window.__menuHeldAnimations = [...new Set([
      ...window.__menuHeldAnimations, ...dialog.getAnimations({ subtree: true }),
    ])]
    for (const animation of window.__menuHeldAnimations) {
      animation.pause()
      animation.currentTime = Number.isFinite(animation.effect.getTiming().iterations) ? milliseconds : 0
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const surface = dialog.querySelector('[class*="menu-surface"]')
    const rim = dialog.querySelector('[class*="menu-rim"]')
    const scroll = dialog.querySelector('[class*="menu-scroll"]')
    const bounds = element => {
      const rect = element.getBoundingClientRect()
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height }
    }
    return {
      milliseconds, viewport: { width: innerWidth, height: innerHeight },
      dialog: bounds(dialog), surface: bounds(surface), rim: bounds(rim),
      shellClip: getComputedStyle(dialog).clipPath,
      surfaceClip: getComputedStyle(surface).clipPath, rimClip: getComputedStyle(rim).clipPath,
      scrollTop: scroll.scrollTop,
      lowerPointsOwned: [.1, .5, .9].every(x => [.55, .75, .95].every(y =>
        document.elementFromPoint(innerWidth * x, innerHeight * y)?.closest('dialog') === dialog)),
      rows: [...dialog.querySelectorAll('nav a')].map(element => ({ opacity: Number(getComputedStyle(element).opacity), ...bounds(element) })),
      runningAnimations: dialog.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
      heldClipCount: window.__menuClipAnimations.length,
    }
  }, milliseconds)
}

async function pixelDifference(page, before, after) {
  return page.evaluate(async ({ before, after }) => {
    const decode = async encoded => {
      const image = new Image()
      image.src = `data:image/png;base64,${encoded}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data }
    }
    const a = await decode(before), b = await decode(after)
    if (a.width !== b.width || a.height !== b.height) throw new Error('Compared frames must have identical dimensions')
    const firstRow = Math.floor(a.height / 2)
    const total = a.width * (a.height - firstRow)
    let changed = 0
    let minX = a.width, minY = a.height, maxX = -1, maxY = -1
    for (let y = firstRow; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      const offset = (y * a.width + x) * 4
      if (Math.max(...[0, 1, 2].map(channel => Math.abs(a.pixels[offset + channel] - b.pixels[offset + channel]))) <= 12) continue
      changed++
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
    return {
      width: a.width, height: a.height, firstComparedRow: firstRow, threshold: 12,
      changedPixels: changed, comparedPixels: total, changedRatio: changed / total,
      changedBounds: changed ? { minX, minY, maxX, maxY } : null,
    }
  }, { before: before.toString('base64'), after: after.toString('base64') })
}

const cases = [
  { name: 'grow via header', entry: 'header', initial: { width: 390, height: 390 }, final: { width: 390, height: 844 } },
  { name: 'grow via more', entry: 'more', initial: { width: 390, height: 390 }, final: { width: 390, height: 844 } },
  { name: 'shrink via header', entry: 'header', initial: { width: 390, height: 844 }, final: { width: 390, height: 390 } },
  { name: 'rotate via more', entry: 'more', initial: { width: 390, height: 844 }, final: { width: 844, height: 390 } },
  { name: 'fixed narrow via more', entry: 'more', initial: { width: 390, height: 844 } },
  { name: 'fixed desktop via header', entry: 'header', initial: { width: 1280, height: 800 } },
]

for (const scenario of cases) {
  test(`P3R menu pixel continuity: ${scenario.name}`, async t => {
    const page = await session(t, scenario.initial)
    const animations = await openAndHold(page, scenario.entry)
    await frame(page, 160)
    if (scenario.final) await page.setViewportSize(scenario.final)
    const before = await frame(page, 419)
    const beforeImage = await page.screenshot({ animations: 'allow' })
    const after = await frame(page, 440)
    const afterImage = await page.screenshot({ animations: 'allow' })
    const pixels = await pixelDifference(page, beforeImage, afterImage)
    const evidence = { engine, baseURL, scenario, animations, before, after, pixels }
    t.diagnostic(JSON.stringify({ scenario: scenario.name, pixels, beforeSurfaceBottom: before.surface.bottom, afterSurfaceBottom: after.surface.bottom }))
    if (evidenceDirectory) {
      const stem = join(evidenceDirectory, `p3r-menu-${engine}-${scenario.name.replaceAll(' ', '-')}`)
      await Promise.all([
        writeFile(`${stem}-before-end.png`, beforeImage),
        writeFile(`${stem}-after-end.png`, afterImage),
        writeFile(`${stem}.json`, `${JSON.stringify(evidence, null, 2)}\n`),
      ])
    }
    assert(pixels.changedRatio < .01, `Lower-half RGB changes >12 must cover <1% at the animation endpoint; observed ${(pixels.changedRatio * 100).toFixed(3)}%`)
    for (const state of [before, after]) {
      assert(Math.abs(state.dialog.bottom - state.viewport.height) < 1 && Math.abs(state.surface.bottom - state.viewport.height) < 1 && Math.abs(state.rim.bottom - state.viewport.height) < 1, 'Dialog, surface and rim cover the resized viewport bottom')
      assert.equal(state.shellClip, 'none', 'The native dialog remains an unclipped stationary shell')
      assert.equal(state.scrollTop, 0, 'Menu focus never scrolls the flood surface')
      assert.equal(state.runningAnimations, 0, 'All captured menu animations are held for deterministic screenshots')
      assert.equal(state.heldClipCount, 2, 'Both original clip Animation references survive through the endpoint')
      assert.equal(state.rows.length, 8)
      assert(state.rows.every(row => row.opacity > .99), 'All eight navigation rows have completed their entrance')
    }
    assert.notEqual(before.surfaceClip, 'none', '419ms is still inside the surface clip animation')
    assert.notEqual(before.rimClip, 'inset(50%)', '419ms still samples the animated rim')
    assert.equal(after.surfaceClip, 'none', '440ms samples the released fill:none surface')
    assert(after.lowerPointsOwned, 'The final menu owns points throughout the lower half')
  })
}

test('P3R menu resized interrupted close preserves both clip edges and reduced motion', async t => {
  const page = await session(t, { width: 390, height: 390 })
  const trigger = opener(page, 'header')
  await openAndHold(page, 'header')
  await frame(page, 80)
  await page.setViewportSize({ width: 390, height: 844 })
  const beforeClose = await frame(page, 80)
  await page.evaluate(() => { window.__menuHoldDrain = true })
  await page.keyboard.press('Escape')
  const drain = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')
    const surface = dialog.querySelector('[class*="menu-surface"]')
    const rim = dialog.querySelector('[class*="menu-rim"]')
    return {
      count: window.__menuDrainAnimations.length,
      surfaceClip: getComputedStyle(surface).clipPath,
      rimClip: getComputedStyle(rim).clipPath,
      times: window.__menuDrainAnimations.map(animation => animation.currentTime),
    }
  })
  const evidence = { engine, beforeClose, drain }
  if (evidenceDirectory) await writeFile(join(evidenceDirectory, `p3r-menu-${engine}-resized-close.json`), `${JSON.stringify(evidence, null, 2)}\n`)
  assert.equal(drain.count, 2, 'Both closing layers are held at creation')
  assert.deepEqual(drain.times, [0, 0], 'Compare the exact first frame of the drain')
  assert.equal(drain.surfaceClip, beforeClose.surfaceClip, 'Resizing then closing preserves the visible surface edge without a jump')
  assert.equal(drain.rimClip, beforeClose.rimClip, 'Resizing then closing preserves the visible rim edge without a jump')
  await page.evaluate(() => { for (const animation of window.__menuDrainAnimations) animation.finish() })
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await opener(page, 'more').click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  assert.equal(await dialog.evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'Reduced motion has no menu entrance or background animation')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener(page, 'more')).toBeFocused()
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
})
