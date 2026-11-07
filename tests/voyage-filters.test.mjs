import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

// ARK_VERIFY_PORT=10570 node scripts/verify-blog.mjs --serve
// TEST_BASE_URL=http://127.0.0.1:10570 node --test tests/voyage-filters.test.mjs
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10570'
const categories = ['Development', '界面设计', '摄影与旅行', '长期系统工程与视觉设计研究札记', '随手记', '工具', 'Readings', '实验日志']
const lastCategory = categories.at(-1)
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function session(t, width, mode) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: mode, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(mode => {
    localStorage.setItem('ark.design.v1', 'voyage')
    localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, mode)
  // Exercise the existing category contract with more labels than fit on a phone.
  await context.route('**/api/blog/knowledge/meta/categories', route => route.fulfill({ json: { data: categories } }))
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  const strip = page.locator('[data-tool-group="query"] [class*="filters"]')
  const date = page.locator('[data-tool-group="date"]')
  return { page, strip, date }
}

async function openCategory(page, strip, category, date = '') {
  const query = new URLSearchParams({ category })
  if (date) query.set('date', date)
  await page.goto(`${baseURL}/articles?${query}`, { waitUntil: 'networkidle' })
  await expect(strip.getByRole('button', { name: category, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => document.fonts.ready)
}

async function fullyVisible(item) {
  await expect.poll(() => item.evaluate(element => {
    const strip = element.parentElement, viewport = strip.getBoundingClientRect(), target = element.getBoundingClientRect()
    const left = viewport.left + strip.clientLeft
    return target.left >= left - 1 && target.right <= left + strip.clientWidth + 1
  }), { message: 'The complete selected/focused category stays inside its horizontal strip' }).toBe(true)
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Filters do not widen the page')
}

test('Voyage category deep links reveal the selected short or long label and retain it across responsive resizing', async t => {
  for (const [width, mode] of [[320, 'light'], [390, 'dark'], [1440, 'light']]) {
    const { page, strip } = await session(t, width, mode)
    for (const category of [lastCategory, categories[3]]) {
      await openCategory(page, strip, category)
      const selected = strip.getByRole('button', { name: category, exact: true })
      await fullyVisible(selected)
      await expect(selected).toHaveAttribute('title', category)
      assert.equal(await page.evaluate(() => scrollY), 0, 'Revealing a URL-selected category does not scroll the page')
      await noOverflow(page)
    }
    if (width === 1440) {
      await openCategory(page, strip, lastCategory)
      // Keep a nonzero reading position to detect accidental scrollIntoView().
      await page.setViewportSize({ width, height: 600 })
      await page.evaluate(() => scrollTo({ top: 60, behavior: 'instant' }))
      const scroll = await page.evaluate(() => scrollY)
      assert(scroll > 0)
      for (const nextWidth of [390, 320, 1440]) {
        await page.setViewportSize({ width: nextWidth, height: 600 })
        await fullyVisible(strip.getByRole('button', { name: lastCategory, exact: true }))
        assert(Math.abs(await page.evaluate(() => scrollY) - scroll) <= 1, 'Resize reveals the category without changing vertical position')
        await noOverflow(page)
      }
    }
  }
})

test('Voyage keyboard categories remain visible beside a complete date, and clearing the date restores two compact rows', async t => {
  for (const [width, mode] of [[320, 'light'], [390, 'dark']]) {
    const { page, strip, date } = await session(t, width, mode)
    await openCategory(page, strip, lastCategory, '2026-10-01')
    await fullyVisible(strip.getByRole('button', { name: lastCategory, exact: true }))
    const dateButton = date.getByRole('button', { name: '日期: 2026-10-01', exact: true })
    await expect(dateButton).toBeVisible()
    await expect(dateButton.locator('span')).toHaveText('2026 / 10 / 01')
    assert(await dateButton.locator('span').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'The day of the month is not ellipsized')
    let row = await strip.boundingBox(), dateRow = await date.boundingBox(), search = await page.getByRole('search').boundingBox()
    assert(dateRow.y >= row.y + row.height && search.y >= dateRow.y + dateRow.height, 'An active date uses a clear separate row')
    const all = strip.getByRole('button', { name: '全部', exact: true })
    await all.focus()
    await fullyVisible(all)
    for (const category of categories) {
      await page.keyboard.press('Tab')
      const focused = strip.getByRole('button', { name: category, exact: true })
      await expect(focused).toBeFocused()
      await fullyVisible(focused)
    }
    for (let index = categories.length - 1; index >= 0; index--) {
      await page.keyboard.press('Shift+Tab')
      const focused = index ? strip.getByRole('button', { name: categories[index - 1], exact: true }) : all
      await expect(focused).toBeFocused()
      await fullyVisible(focused)
    }
    await page.keyboard.press('Enter')
    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe(null)
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    assert.equal(new URL(page.url()).searchParams.get('date'), '2026-10-01')
    await fullyVisible(all)
    // Return to the final category before the available strip width shrinks.
    for (let index = 0; index < categories.length; index++) await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(strip.getByRole('button', { name: lastCategory, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await date.getByRole('button', { name: '清除筛选', exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('date')).toBe(null)
    await expect(date.getByRole('button', { name: '日期: 不限日期', exact: true })).toBeVisible()
    await fullyVisible(strip.getByRole('button', { name: lastCategory, exact: true }))
    row = await strip.boundingBox(); dateRow = await date.boundingBox(); search = await page.getByRole('search').boundingBox()
    assert(Math.abs(row.y - dateRow.y) <= 2 && search.y >= row.y + row.height, 'Clearing the date returns categories/date and search to two rows')
    assert.equal(await page.evaluate(() => scrollY), 0, 'Keyboard disclosure does not move the page vertically')
    await noOverflow(page)
  }
})
