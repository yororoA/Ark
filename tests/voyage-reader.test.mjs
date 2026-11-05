import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Run against the isolated reader fixture, never a live account or production API.
// ARK_VERIFY_PORT=10550 ARK_VERIFY_READER=1 node scripts/verify-blog.mjs --serve
// TEST_BASE_URL=http://127.0.0.1:10550 node --test tests/voyage-reader.test.mjs
// Fixture: four long passages, five h2/h3/h4 headings (two identical), fenced
// pseudo-headings, an image without reserved dimensions, and a heading-free note.
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10550'
const articleId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const shortArticleId = 'eeeeeeeeeeeeeeeeeeeeeeee'
const articlePath = `/articles/${articleId}`
const headingTexts = ['First bearing', 'A quiet interval', 'First bearing', 'Pocket note', 'Landfall']
const sectionId = index => `voyage-${articleId}-section-${index + 1}`
const shots = process.env.READER_SCREENSHOT_DIR
let browser

before(async () => {
  browser = await chromium.launch({ headless: true })
  if (shots) await mkdir(shots, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, width = 1440, mode = 'light') {
  const context = await browser.newContext({
    viewport: { width, height: width === 320 ? 720 : 1000 },
    hasTouch: width === 320, reducedMotion: 'reduce', colorScheme: mode,
  })
  t.after(() => context.close())
  await context.addInitScript(mode => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    for (const [key, value] of Object.entries({
      'ark.design.v1': 'voyage', 'ark.theme': mode, 'ark.locale': 'en', 'ark.mascot:v1': 'off',
    })) if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
  }, mode)
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  const errors = [], contentRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'GET' && /\/api\/blog\/(knowledge|moments)(\/|\?|$)/.test(request.url())) contentRequests.push(request.url())
  })
  t.after(() => assert.deepEqual(errors, [], 'Reading must not produce uncaught browser errors'))
  return { context, page, contentRequests }
}

async function ready(page, path = articlePath, waitUntil = 'networkidle') {
  await page.goto(`${baseURL}${path}`, { waitUntil })
  await expect(page.getByTestId('voyage-reader')).toBeVisible()
  await expect(page.getByTestId('voyage-reading-guide')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

function outlineLinks(page) {
  return page.getByTestId('voyage-reading-outline').locator('a[href*="-section-"]')
}

async function revealOutline(page) {
  const outline = page.getByTestId('voyage-reading-outline')
  if (!(await outline.evaluate(element => element.open))) await outline.locator('summary').click()
  return outline
}

async function assertDestination(page, index) {
  const heading = page.locator(`[id="${sectionId(index)}"]`)
  await expect(page).toHaveURL(`${baseURL}${articlePath}#${sectionId(index)}`)
  await expect(heading).toBeFocused()
  await expect.poll(() => heading.evaluate(element => {
    const header = document.querySelector('[data-blog-root] > header')
    const guide = document.querySelector('[data-testid="voyage-reading-guide"]')
    const top = element.getBoundingClientRect().top
    const bottom = Math.max(header?.getBoundingClientRect().bottom || 0,
      innerWidth <= 980 ? guide?.getBoundingClientRect().bottom || 0 : 0)
    return top >= Math.max(0, bottom) && top < innerHeight * 0.6
  })).toBe(true)
  await expect(outlineLinks(page).nth(index)).toHaveAttribute('aria-current', 'location')
}

async function progress(page) {
  return Number(await page.getByTestId('voyage-reading-progress').getAttribute('aria-valuenow'))
}

async function assertMeasuredProgress(page) {
  await expect.poll(async () => {
    const expected = await page.locator('[data-voyage-prose]').evaluate(prose => {
      const header = document.querySelector('[data-blog-root] > header')
      const guide = document.querySelector('[data-testid="voyage-reading-guide"]')
      const navigation = document.querySelector('[data-blog-root] > nav')
      const navigationRect = navigation?.getBoundingClientRect()
      const visibleBottom = navigationRect?.height > 0 && getComputedStyle(navigation).position === 'fixed'
        ? Math.min(innerHeight, navigationRect.top) : innerHeight
      const offset = (header?.getBoundingClientRect().height || 86)
        + (innerWidth <= 980 ? guide?.getBoundingClientRect().height || 0 : 0) + 24
      const start = prose.firstElementChild.getBoundingClientRect().top + scrollY - offset
      const end = prose.lastElementChild.getBoundingClientRect().bottom + scrollY - visibleBottom
      const fraction = end <= start ? Number(scrollY >= end) : (scrollY - start) / (end - start)
      return Math.round(Math.max(0, Math.min(1, fraction)) * 100)
    })
    return Math.abs((await progress(page)) - expected)
  }).toBeLessThanOrEqual(1)
}

async function setDesign(page, design) {
  // Exercise the supported cross-tab preference event without route unmounts.
  await page.evaluate(design => {
    const key = 'ark.design.v1', oldValue = localStorage.getItem(key)
    localStorage.setItem(key, design)
    dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: design, storageArea: localStorage }))
  }, design)
  await expect(page.locator('html')).toHaveAttribute('data-design', design)
}

for (const width of [320, 1440]) for (const mode of ['light', 'dark']) {
  test(`Voyage reader exposes the real outline without overflow: ${width}px ${mode}`, async t => {
    const { page, contentRequests } = await session(t, width, mode)
    await ready(page)
    const before = contentRequests.length
    const headings = page.locator('[data-voyage-prose] h2, [data-voyage-prose] h3, [data-voyage-prose] h4')
    await expect(headings).toHaveText(headingTexts)
    const ids = await headings.evaluateAll(nodes => nodes.map(node => node.id))
    assert.equal(new Set(ids).size, 5, 'Repeated headings need separate destinations')
    assert.deepEqual(ids, headingTexts.map((_, index) => sectionId(index)))
    await expect(outlineLinks(page)).toHaveCount(5)
    await expect(page.getByTestId('voyage-reading-outline')).toHaveJSProperty('open', width === 1440)
    if (width === 320) await revealOutline(page)
    const labels = await outlineLinks(page).allTextContents()
    headingTexts.forEach((title, index) => assert(labels[index].includes(title)))
    assert(labels.every(label => !label.includes('Not a real heading') && !label.includes('Still just code')))
    await expect(page.locator('[data-voyage-prose] pre')).toContainText('## Not a real heading')
    const meter = page.getByTestId('voyage-reading-progress')
    await expect(meter).toHaveAttribute('role', 'progressbar')
    assert((await progress(page)) >= 0 && (await progress(page)) <= 100)
    await assertMeasuredProgress(page)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), mode)
    assert.equal(contentRequests.length, before, 'Opening the outline reuses the loaded article')
    if (shots) {
      if (width === 320) {
        await page.screenshot({ path: `${shots}/reader-${width}-${mode}-outline.png` })
        await page.getByTestId('voyage-reading-outline').locator('summary').click()
      }
      await page.screenshot({ path: `${shots}/reader-${width}-${mode}.png` })
    }
  })
}

test('Voyage reader honors initial deep links and browser Back without fetching again', async t => {
  const { page, context, contentRequests } = await session(t)
  let releaseImage
  const gate = new Promise(resolve => { releaseImage = resolve })
  t.after(() => releaseImage())
  await context.route('**/reader-delayed.svg', async route => {
    await gate
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1800"><rect width="960" height="1800" fill="#203447"/></svg>' })
  })
  await ready(page, `${articlePath}#${sectionId(2)}`, 'domcontentloaded')
  await assertDestination(page, 2)
  releaseImage()
  await expect.poll(() => page.locator('[data-voyage-prose] img').evaluate(element => element.complete && element.naturalHeight === 1800)).toBe(true)
  await assertDestination(page, 2)
  const before = contentRequests.length
  await assertMeasuredProgress(page)
  const thirdProgress = await progress(page)
  await outlineLinks(page).nth(4).click()
  await assertDestination(page, 4)
  assert((await progress(page)) > thirdProgress, 'Progress advances with the actual reading location')
  await page.goBack()
  await assertDestination(page, 2)
  await expect.poll(() => progress(page)).toBeLessThan(thirdProgress + 3)
  // Also return to a free reading position that had no section hash at all.
  await page.evaluate(() => {
    history.replaceState(history.state, '', location.pathname)
    scrollTo({ top: 830, behavior: 'instant' })
  })
  await assertMeasuredProgress(page)
  const unanchoredPosition = await page.evaluate(() => scrollY)
  await outlineLinks(page).nth(4).click()
  await assertDestination(page, 4)
  await page.goBack()
  await expect(page).toHaveURL(`${baseURL}${articlePath}`)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(unanchoredPosition)
  assert.equal(contentRequests.length, before, 'Hash navigation never reloads article data')
})

test('Voyage mobile outline closes after a keyboard jump and follows manual scrolling', async t => {
  const { page, contentRequests } = await session(t, 320, 'dark')
  await ready(page)
  const before = contentRequests.length
  const outline = await revealOutline(page)
  await outlineLinks(page).nth(2).focus()
  await page.keyboard.press('Enter')
  await expect(outline).toHaveJSProperty('open', false)
  await assertDestination(page, 2)
  await page.locator(`[id="${sectionId(4)}"]`).evaluate(element => {
    const header = document.querySelector('[data-blog-root] > header')
    const guide = document.querySelector('[data-testid="voyage-reading-guide"]')
    scrollTo({ top: scrollY + element.getBoundingClientRect().top - (header?.getBoundingClientRect().height || 0) - (guide?.getBoundingClientRect().height || 0) - 24, behavior: 'instant' })
  })
  await expect(outlineLinks(page).nth(4)).toHaveAttribute('aria-current', 'location')
  await assertMeasuredProgress(page)
  assert.equal(new URL(page.url()).hash, `#${sectionId(2)}`, 'Passive reading must not fill browser history with section changes')
  assert.equal(contentRequests.length, before)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})

test('Voyage progress remeasures delayed images, text reflow and viewport changes', async t => {
  const { page, context, contentRequests } = await session(t)
  let releaseImage
  const gate = new Promise(resolve => { releaseImage = resolve })
  t.after(() => releaseImage())
  await context.route('**/reader-delayed.svg', async route => {
    await gate
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="2400"><rect width="960" height="2400" fill="#203447"/></svg>' })
  })
  await ready(page, `${articlePath}#${sectionId(1)}`, 'domcontentloaded')
  await assertDestination(page, 1)
  const before = contentRequests.length
  const image = page.locator('[data-voyage-prose] img')
  // The reader deliberately leaves the initial anchor while the image is pending.
  const backToStart = page.getByTestId('voyage-reading-guide').getByRole('link', { name: 'Back to the beginning' })
  await backToStart.evaluate(element => element.focus({ preventScroll: true }))
  await page.evaluate(() => scrollBy({ top: 180, behavior: 'instant' }))
  await assertMeasuredProgress(page)
  const manualScrollTop = await page.evaluate(() => scrollY)
  const initial = await progress(page)
  releaseImage()
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalHeight === 2400)).toBe(true)
  await expect.poll(() => progress(page)).toBeLessThan(initial)
  await expect(backToStart).toBeFocused()
  assert(Math.abs((await page.evaluate(() => scrollY)) - manualScrollTop) <= 2, 'Late image load does not pull the reader back to the initial hash')
  await assertMeasuredProgress(page)
  const imageProgress = await progress(page)
  // Model a late font metric change without waiting for an external font service.
  await page.locator('[data-voyage-prose]').evaluate(element => { element.style.fontSize = '25px'; element.style.lineHeight = '2.1' })
  await expect.poll(() => progress(page)).not.toBe(imageProgress)
  await assertMeasuredProgress(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await expect(page.getByTestId('voyage-reading-outline')).toHaveJSProperty('open', false)
  await revealOutline(page)
  await outlineLinks(page).nth(4).click()
  await assertDestination(page, 4)
  await assertMeasuredProgress(page)
  const earlier = await progress(page)
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect.poll(() => progress(page)).toBe(100)
  assert(earlier < 100, 'The last heading is not automatically the end of its content')
  assert.equal(contentRequests.length, before, 'Layout changes do not request article content again')
})

test('Voyage reader removes its enhancements on theme change and does not invent a short-article outline', async t => {
  const { page, contentRequests } = await session(t)
  await ready(page)
  const before = contentRequests.length
  await setDesign(page, 'archive')
  await expect(page.getByTestId('voyage-reader')).toHaveCount(0)
  await expect(page.getByTestId('voyage-reading-guide')).toHaveCount(0)
  await expect(page.locator('[id^="voyage-"]')).toHaveCount(0)
  const headingAttributes = await page.locator('[data-voyage-prose] h2, [data-voyage-prose] h3, [data-voyage-prose] h4').evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute('id'), tabindex: node.getAttribute('tabindex'), scrollMargin: node.style.scrollMarginTop,
  })))
  assert.deepEqual(headingAttributes, headingTexts.map(() => ({ id: null, tabindex: null, scrollMargin: '' })))
  assert.equal(contentRequests.length, before)
  await setDesign(page, 'voyage')
  await expect(page.getByTestId('voyage-reading-guide')).toBeVisible()
  await expect(outlineLinks(page)).toHaveCount(5)
  await ready(page, `/articles/${shortArticleId}`)
  await expect(page.getByTestId('voyage-reading-outline')).toHaveCount(0)
  await expect(page.getByTestId('voyage-reading-guide').locator('a[href*="-section-"]')).toHaveCount(0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})
