import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { createLocalVideo, galleryFiles, longDescription, mockGallery, showGallery } from './fixtures/voyage-gallery.mjs'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const artifacts = process.env.CONTACT_SHEET_ARTIFACTS
let browser, video
before(async () => {
  browser = await chromium.launch({ headless: true })
  video = await createLocalVideo(browser)
  if (artifacts) await mkdir(artifacts, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, { width = 1440, height = 900, mode = 'light', timezoneId = 'Asia/Shanghai', long = false, broken = false, files: supplied, design = 'voyage' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId, reducedMotion: 'reduce' })
  await context.addInitScript(({ mode, design }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': 'en', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
  }, { mode, design })
  const files = supplied || galleryFiles(baseURL, { long, broken })
  const reads = await mockGallery(context, files, video)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(12000)
  t.after(async () => { await context.close(); assert.deepEqual(errors, []) })
  await showGallery(page, baseURL)
  await expect.poll(() => reads.gallery).toBeGreaterThan(0)
  await expect(page.locator('figure')).toHaveCount(files.length)
  return { page, files, reads, context }
}

const frames = page => page.locator('[data-contact-sheet] figure[data-gallery-index]')
const descriptions = async locator => locator.evaluateAll(nodes => nodes.map(node => node.querySelector('button').getAttribute('aria-label').replace(/^Preview /, '')))
async function readOrder(page) {
  const positions = await frames(page).evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { top: box.top, left: box.left, right: box.right, width: box.width }
  }))
  positions.slice(1).forEach((box, index) => {
    const previous = positions[index]
    assert(box.top > previous.top + 3 || (Math.abs(box.top - previous.top) <= 3 && box.left > previous.left), 'The visual reading order follows the same sequence as the viewer')
  })
  return positions
}

test('Months, visual reading order and viewer navigation describe the same chronological sequence', async t => {
  const { page, files, reads } = await session(t)
  const ordered = [files[2], files[4], files[0], files[3], files[1], files[5]]
  await expect(page.locator('[data-contact-sheet]')).toBeVisible()
  assert.deepEqual(await descriptions(frames(page)), ordered.map(file => file.desc))
  await readOrder(page)
  assert.deepEqual(await frames(page).evaluateAll(nodes => nodes.map(node => Number(node.dataset.galleryIndex))), [0, 1, 2, 3, 4, 5])
  const groups = page.locator('section[data-gallery-month]')
  await expect(groups).toHaveCount(3)
  for (const [index, members] of [[0, ordered.slice(0, 2)], [1, ordered.slice(2, 4)], [2, ordered.slice(4)]]) {
    assert.deepEqual(await descriptions(groups.nth(index).locator('figure')), members.map(file => file.desc))
  }
  await expect(groups.nth(0)).toContainText('2026')
  await expect(groups.nth(1)).toContainText('2026')
  const before = reads.gallery
  const opener = frames(page).first().getByRole('button')
  await opener.click()
  for (let index = 0; index < ordered.length; index++) {
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading')).toHaveText(ordered[index].desc)
    if (index < ordered.length - 1) await page.keyboard.press('ArrowRight')
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
  assert.equal(reads.gallery, before, 'Opening and traversing already loaded media does not request the gallery again')
})

test('Image and video filters retain ordering and never invent empty months or reload the data', async t => {
  const { page, files, reads } = await session(t)
  const before = reads.gallery
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  assert.deepEqual(await descriptions(frames(page)), [files[2], files[4], files[0], files[1], files[5]].map(file => file.desc))
  await readOrder(page)
  await page.getByRole('button', { name: 'Videos', exact: true }).click()
  await expect(frames(page)).toHaveCount(1)
  await expect(page.locator('section[data-gallery-month]')).toHaveCount(1)
  await expect(frames(page).first()).toContainText(files[3].desc)
  await frames(page).first().getByRole('button').click()
  await expect(page.getByRole('dialog').locator('video')).toHaveAttribute('controls', '')
  await expect.poll(() => page.getByRole('dialog').locator('video').evaluate(element => element.videoWidth)).toBe(160)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(frames(page)).toHaveCount(6)
  assert.equal(reads.gallery, before, 'Filtering is performed against the loaded collection')
})

test('A date near midnight is grouped by the same local month that its visible date reports', async t => {
  const source = galleryFiles(baseURL)
  for (const [timezoneId, count] of [['Asia/Shanghai', 2], ['UTC', 1]]) {
    const { page } = await session(t, { timezoneId, files: [source[4], source[2], source[0]] })
    const groups = page.locator('section[data-gallery-month]')
    await expect(groups).toHaveCount(2)
    await expect(groups.first().locator('figure')).toHaveCount(count)
    const boundary = frames(page).filter({ has: page.getByRole('button', { name: `Preview ${source[4].desc}`, exact: true }) })
    await expect(boundary.locator('time')).toContainText(timezoneId === 'UTC' ? '31' : '01')
  }
})

for (const width of [320, 390, 1440]) for (const mode of ['light', 'dark']) {
  test(`Photographs, complete descriptions and dates stay readable: ${width}px ${mode}`, async t => {
    const { page, files } = await session(t, { width, height: 844, mode, long: true })
    const positions = await readOrder(page)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    if (width < 600) {
      assert(positions.every(box => Math.abs(box.left - positions[0].left) < 1 && box.width >= width * .8), 'Mobile uses one readable photograph per row')
    }
    for (const frame of await frames(page).all()) {
      const date = frame.locator('time')
      if (await date.count()) await expect(date).toBeVisible()
      const picture = frame.locator('img')
      if (await picture.count()) {
        await picture.scrollIntoViewIfNeeded()
        await expect.poll(() => picture.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
        const fit = await picture.evaluate(image => {
          const box = image.getBoundingClientRect(), window = image.closest('button').getBoundingClientRect()
          return { mode: getComputedStyle(image).objectFit, ratio: box.width / box.height, original: image.naturalWidth / image.naturalHeight,
            inside: box.left >= window.left && box.right <= window.right && box.top >= window.top && box.bottom <= window.bottom }
        })
        assert.equal(fit.mode, 'contain', 'The photograph is shown in full instead of cropped to decorate a tile')
        assert(fit.inside && Math.abs(fit.ratio - fit.original) < .01, 'The full original image fits inside its mount without stretching')
      }
    }
    const longFrame = frames(page).filter({ has: page.getByRole('button', { name: `Preview ${files[0].desc}`, exact: true }) })
    await expect(longFrame.locator('figcaption')).toContainText(longDescription.repeat(3))
    const clipped = await longFrame.locator('figcaption').evaluate(caption => [...caption.querySelectorAll('*'), caption].some(element => {
      const style = getComputedStyle(element)
      return (element.scrollHeight > element.clientHeight + 1 && ['hidden', 'clip'].includes(style.overflowY)) || (style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1)
    }))
    assert.equal(clipped, false, 'Long descriptions remain readable rather than being hidden behind ellipses')
    const transparent = frames(page).filter({ has: page.getByRole('button', { name: `Preview ${files[1].desc}`, exact: true }) }).locator('img')
    const backing = await transparent.evaluate(image => {
      const style = getComputedStyle(image)
      const surface = style.backgroundImage === 'none' ? style.backgroundColor : style.backgroundImage
      const colors = [...surface.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(',').map(Number))
      return colors.length > 0 && colors.every(color => (color[3] ?? 1) === 1 && Math.min(...color.slice(0, 3)) >= 90 && Math.max(...color.slice(0, 3)) <= 205 && Math.max(...color.slice(0, 3)) - Math.min(...color.slice(0, 3)) < 45)
    })
    assert.equal(backing, true, 'Transparent black and white artwork has an opaque neutral backing in both color modes')
    await page.evaluate(() => scrollTo(0, 0))
    if (artifacts) await page.screenshot({ path: `${artifacts}/contact-sheet-${width}-${mode}.png`, fullPage: true })
  })
}

test('Keyboard users can open a chosen frame, navigate the viewer and return to its original focus', async t => {
  const { page, files } = await session(t, { width: 390 })
  const opener = page.getByRole('button', { name: `Preview ${files[4].desc}`, exact: true })
  await opener.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(files[4].desc)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(files[0].desc)
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: `Preview ${files[0].desc}`, exact: true })).toBeFocused()
})

test('A missing image preserves its description, date and place among the remaining photographs', async t => {
  const { page, files } = await session(t, { width: 320, broken: true })
  const broken = frames(page).first()
  await expect(broken).toContainText(files[2].desc)
  await expect(broken.locator('time')).toBeVisible()
  await expect(broken.getByRole('button')).toBeVisible()
  const box = await broken.getByRole('button').boundingBox()
  assert(box.width >= 44 && box.height >= 44, 'The failed media keeps a usable frame instead of collapsing the layout')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  const next = frames(page).nth(1).getByRole('button')
  await next.click()
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(files[4].desc)
})

test('An empty collection remains an honest empty state without a phantom contact sheet', async t => {
  const { page } = await session(t, { width: 320, files: [] })
  await expect(frames(page)).toHaveCount(0)
  await expect(page.locator('section[data-gallery-month]')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('No matching entries.')
})
