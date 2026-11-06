import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const artifacts = process.env.VOYAGE_NAVIGATION_ARTIFACTS
let browser
const results = []
before(async () => {
  browser = await chromium.launch({ headless: true })
  if (artifacts) await mkdir(artifacts, { recursive: true })
})
after(async () => {
  await browser?.close()
  if (artifacts) await writeFile(`${artifacts}/navigation-intent.json`, JSON.stringify(results, null, 2))
})

async function session(t, { motion = 'no-preference', width = 1440 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion })
  t.after(() => context.close())
  await context.addInitScript(() => {
    localStorage.setItem('ark.design.v1', 'voyage')
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  })
  await context.route('**/api/session*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('all')
    ? { data: [], activeUid: null } : { data: null } }))
  await context.route('**/api/blog/sse/subscribe', route => route.fulfill({ contentType: 'text/event-stream', body: ': isolated\n\n' }))
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  t.after(() => assert.deepEqual(errors, []))
  return { context, page }
}

async function beginRecord(page) {
  await page.evaluate(() => {
    window.intentFrames = []; window.intentRecording = true
    const began = performance.now()
    const sample = () => {
      if (!window.intentRecording) return
      window.intentFrames.push({
        ms: Math.round(performance.now() - began), path: location.pathname,
        phase: document.documentElement.dataset.voyageWipe || 'idle',
        arrival: document.querySelector('[data-voyage-heading-arrival]')?.dataset.arrival,
        loading: !!document.querySelector('[data-route-loading]'),
      })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}
async function finishRecord(page, name) {
  const frames = await page.evaluate(() => { window.intentRecording = false; return window.intentFrames })
  results.push({ name, frames })
  return frames
}
function noPassage(frames) {
  assert(frames.length > 0)
  assert(frames.every(frame => frame.phase === 'idle'), 'Ordinary navigation never requests a voyage cover')
}
async function headerGo(page, destination) {
  await page.locator(`header[class*="site-header"] nav a[href="${destination}"]`).click()
  await page.waitForURL(`**${destination}`)
  await expect(page.locator('main h1')).toBeVisible()
}
async function openMenu(page) {
  await page.locator('[data-menu-toggle]').click()
  const menu = page.getByTestId('voyage-menu')
  await expect(menu).toBeVisible()
  return menu
}

test('Ordinary cold navigation exposes native waiting without covering available controls', async t => {
  const { context, page } = await session(t)
  let release, requests = 0
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/articles*', async route => {
    if (new URL(route.request().url()).pathname === '/articles' && route.request().headers().rsc === '1') {
      requests++; await pending
    }
    await route.continue()
  })
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  await beginRecord(page)
  await page.locator('header[class*="site-header"] nav a[href="/articles"]').click()
  await expect.poll(() => requests).toBeGreaterThan(0)
  await page.waitForTimeout(600)
  await expect(page.getByTestId('voyage-wipe')).toHaveAttribute('data-phase', 'idle')
  assert.equal(await page.locator('html').getAttribute('data-voyage-wipe'), null)
  assert.equal(await page.locator('main').evaluate(element => !!element.closest('[inert]')), false)
  assert(await page.locator('main').evaluate(element => !!element.textContent.trim()), 'Waiting retains content or the native status instead of an empty main')
  const menu = await openMenu(page)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  if (artifacts) await page.screenshot({ path: `${artifacts}/cold-navigation-waiting.png` })
  release()
  await page.waitForURL('**/articles')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('[data-voyage-heading-arrival]')).toHaveAttribute('data-arrival', 'settled')
  const frames = await finishRecord(page, 'cold ordinary navigation')
  noPassage(frames)
  assert(frames.some(frame => frame.path === '/articles' && frame.arrival === 'running'), 'Ordinary arrival retains the small non-blocking heading response')
})

test('Cached ordinary routes and browser history remain direct', async t => {
  const { page } = await session(t)
  await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
  await headerGo(page, '/archive')
  await headerGo(page, '/articles')
  await beginRecord(page)
  await headerGo(page, '/archive')
  await expect(page.locator('[data-voyage-heading-arrival]')).toHaveAttribute('data-arrival', 'settled')
  await page.goBack(); await page.waitForURL('**/articles')
  await expect(page.locator('main h1')).toBeVisible()
  await page.goForward(); await page.waitForURL('**/archive')
  await expect(page.locator('main h1')).toBeVisible()
  noPassage(await finishRecord(page, 'cached routes and history'))
  assert.equal(await page.locator('[voyagepassage]').count(), 0, 'The component-only intent never leaks onto an anchor')
})

test('Article content and site footer follow native links, including a destination hash', async t => {
  const { page } = await session(t)
  await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
  await beginRecord(page)
  await page.locator('main a[href^="/articles/aaaaaaaaaaaaaaaaaaaaaaaa"]').first().click()
  await page.waitForURL(url => url.pathname === '/articles/aaaaaaaaaaaaaaaaaaaaaaaa')
  await expect(page.locator('main h1')).toBeVisible()
  await page.locator('footer[class*="site-footer"] a[href="/about#guestbook"]').click()
  await page.waitForURL('**/about#guestbook')
  await expect(page.locator('#guestbook textarea')).toBeVisible()
  const anchorVisible = await page.locator('#guestbook').evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return bounds.top < innerHeight && bounds.bottom > 0
  })
  assert(anchorVisible, 'Native navigation preserves the destination anchor')
  noPassage(await finishRecord(page, 'article and footer links'))
})

test('Mobile tabs navigate directly and preserve their same-page scroll action', async t => {
  const { page } = await session(t, { width: 390 })
  await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
  const navigation = page.locator('nav[class*="app-navigation"]')
  await page.mouse.wheel(0, 600)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100)
  await beginRecord(page)
  await navigation.locator('a[href="/articles"]').click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2)
  assert.equal(new URL(page.url()).pathname, '/articles')
  await navigation.locator('a[href="/moments"]').click()
  await page.waitForURL('**/moments')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('[data-voyage-heading-arrival]')).toHaveAttribute('data-arrival', 'settled')
  noPassage(await finishRecord(page, 'mobile direct tabs'))
  if (artifacts) await page.screenshot({ path: `${artifacts}/mobile-native-arrival.png` })
})

for (const destination of ['/home', '/theme', '/login']) {
  test(`Menu ${destination} retains an explicit complete passage`, async t => {
    const { page } = await session(t)
    await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
    const menu = await openMenu(page)
    await beginRecord(page)
    const link = destination === '/home' ? menu.locator('header a') : menu.locator(`footer a[href^="${destination}"]`)
    await link.click()
    const curtain = page.getByTestId('voyage-wipe')
    await expect(curtain).toHaveAttribute('data-phase', 'closing')
    await page.waitForURL(url => url.pathname === destination)
    await expect(curtain).toHaveAttribute('data-phase', 'idle')
    await expect(menu).toHaveCount(0)
    const frames = await finishRecord(page, `menu ${destination}`)
    for (const phase of ['closing', 'covered', 'opening']) assert(frames.some(frame => frame.phase === phase), `Menu departure keeps ${phase}`)
    assert.equal(await page.locator('[voyagepassage]').count(), 0)
  })
}

test('Menu arrival settles once without starting a second heading animation', async t => {
  const { page } = await session(t)
  await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
  const menu = await openMenu(page)
  await beginRecord(page)
  await menu.locator('nav a[href="/archive"]').click()
  await page.waitForURL('**/archive')
  await expect(page.getByTestId('voyage-wipe')).toHaveAttribute('data-phase', 'idle')
  await page.waitForTimeout(750)
  const frames = await finishRecord(page, 'menu single arrival')
  assert(frames.some(frame => frame.phase === 'opening'))
  assert(frames.filter(frame => frame.path === '/archive').every(frame => frame.arrival !== 'running'))
  await expect(page.locator('[data-voyage-heading-arrival]')).toHaveAttribute('data-arrival', 'settled')
  assert.equal(await page.locator('[data-voyage-heading-arrival]').evaluate(element => element.getAnimations({ subtree: true }).length), 0)
})

for (const menuIntent of [false, true]) {
  test(`Reduced motion remains direct for ${menuIntent ? 'menu' : 'ordinary'} links`, async t => {
    const { page } = await session(t, { motion: 'reduce' })
    await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
    await beginRecord(page)
    if (menuIntent) {
      const menu = await openMenu(page)
      await menu.locator('nav a[href="/archive"]').click()
      await expect(menu).toHaveCount(0)
      await page.waitForURL('**/archive')
    } else await headerGo(page, '/archive')
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('[data-voyage-heading-arrival]')).toHaveAttribute('data-arrival', 'settled')
    noPassage(await finishRecord(page, `reduce ${menuIntent ? 'menu' : 'ordinary'}`))
  })
}
