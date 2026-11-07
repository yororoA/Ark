import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// In-memory preview only; browser routes supply dates relative to today's UTC day.
// ARK_VERIFY_PORT=10570 node scripts/verify-blog.mjs --serve
// TEST_BASE_URL=http://127.0.0.1:10570 node --test tests/home-activity.test.mjs
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10570'
const shots = process.env.ACTIVITY_SCREENSHOT_DIR
const dayAt = offset => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
const activeDates = [dayAt(-83), dayAt(-25), dayAt(-8), dayAt(-1), dayAt(0)]
const stats = { reposCount: 37, monthCommits: 128, languages: [
  { name: 'TypeScript', percent: 61 }, { name: 'Rust', percent: 27 }, { name: 'Go', percent: 12 },
] }
let browser

before(async () => {
  browser = await chromium.launch({ headless: true })
  if (shots) await mkdir(shots, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, { design = 'voyage', width = 1440, mode = 'light', dates = activeDates, github = stats, githubHandler } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width === 320 ? 844 : 1000 },
    hasTouch: width === 320, reducedMotion: 'reduce', colorScheme: mode,
  })
  t.after(() => context.close())
  await context.addInitScript(({ design, mode }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    for (const [key, value] of Object.entries({
      'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': 'zh', 'ark.mascot:v1': 'off',
    })) if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
  }, { design, mode })
  const calls = { github: 0, moments: 0 }
  await context.route('**/api/blog/github/summary', async route => {
    calls.github += 1
    if (githubHandler) return githubHandler(route, calls.github)
    return route.fulfill({ json: { data: github } })
  })
  await context.route('**/api/blog/moments/summary?*', route => {
    calls.moments += 1
    return route.fulfill({ json: { data: { entries: [], activeDates: dates } } })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'Homepage activity has no uncaught browser errors'))
  return { context, page, calls }
}

async function ready(page, { waitUntil = 'networkidle', refresh = true } = {}) {
  await page.goto(`${baseURL}/home`, { waitUntil })
  await expect(page.getByTestId('home-activity')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const initiallyActive = await page.getByTestId('calendar-overview').locator('g[data-date][data-active="true"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-date')))
  const defaultDay = initiallyActive.at(-1) || dayAt(0)
  await assertSelected(page, defaultDay)
  if (refresh) {
    // Home has an SSR fallback. Reconnect revalidation exercises the real SWR path
    // and replaces it with the browser fixture without rewriting server HTML.
    const summary = page.waitForResponse(response => response.url().includes('/api/blog/moments/summary?'))
    await page.evaluate(() => dispatchEvent(new Event('online')))
    await summary
    // Revalidation preserves an existing reading choice. Select the final day
    // explicitly after replacing the SSR fixture with dates relative to today.
    for (let index = 0; index < 12; index += 1) {
      const next = page.getByTestId('calendar-next')
      if (await next.isDisabled()) break
      await next.click()
    }
    await dayButtons(page).last().click()
  }
}

const dayButtons = page => page.getByTestId('activity-calendar').locator('button[data-date]')

async function assertSelected(page, day) {
  const button = page.getByTestId('activity-calendar').locator(`button[data-date="${day}"]`)
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('activity-calendar').locator('button[data-date]:visible')).toHaveCount(7)
  await expect.poll(() => button.evaluate(element => {
    const day = element.getBoundingClientRect(), strip = element.parentElement.getBoundingClientRect()
    return day.left >= strip.left - 1 && day.right <= strip.right + 1
  })).toBe(true)
}

async function appearance(page, key, value) {
  await page.evaluate(({ key, value }) => {
    const oldValue = localStorage.getItem(key)
    localStorage.setItem(key, value)
    dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: value, storageArea: localStorage }))
  }, { key, value })
}

for (const design of ['allotype', 'fold', 'voyage']) for (const width of [320, 1440]) {
  const mode = width === 320 ? 'dark' : 'light'
  test(`Home activity preserves calendar and code statistics: ${design} ${width}px ${mode}`, async t => {
    const { page, calls } = await session(t, { design, width, mode })
    await ready(page)
    const block = page.getByTestId('home-activity')
    await expect(block).toHaveCount(1)
    await expect(page.getByTestId('activity-calendar')).toBeVisible()
    const overview = page.getByTestId('calendar-overview')
    await expect(overview.locator('g[data-date]')).toHaveCount(84)
    const dates = await overview.locator('g[data-date]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-date')))
    assert.equal(new Set(dates).size, 84)
    assert.equal(dates[0], dayAt(-83))
    assert.equal(dates.at(-1), dayAt(0))
    await assertSelected(page, dayAt(0))
    await expect(page.getByTestId('calendar-open')).toHaveAttribute('href', `/moments?date=${dayAt(0)}`)
    const github = page.getByTestId('activity-github')
    await expect(page.getByTestId('code-repositories')).toHaveText('37')
    await expect(page.getByTestId('code-commits')).toHaveText('128')
    await expect(github).toContainText(/近\s*30\s*天/)
    for (const language of stats.languages) {
      await expect(github).toContainText(language.name)
      await expect(github).toContainText(`${language.percent}%`)
    }
    const before = { ...calls }
    await page.getByTestId('calendar-previous').click()
    await page.getByTestId('calendar-next').click()
    assert.deepEqual(calls, before, 'Week changes use the existing 84-day summary')
    assert.equal(calls.github, 1, 'The visible theme does not fetch another GitHub summary')
    assert.equal(calls.moments, 1, 'Calendar reuses the one explicitly refreshed home summary')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), mode)
    if (shots) await block.screenshot({
      path: `${shots}/home-activity-${design}-${width}-${mode}.png`,
      // A tall component capture should not repeat fixed page chrome across its
      // middle. This screenshot-only stylesheet does not affect interactions.
      style: '[data-blog-root] > header, [data-blog-root] > nav, nextjs-portal, [class*="mascot"], [class*="skip-link"] { visibility: hidden !important; }',
    })
  })
}

test('Home calendar keyboard selection crosses weeks and opens the selected active date', async t => {
  const { page, calls } = await session(t, { design: 'fold', width: 320 })
  await ready(page)
  await assertSelected(page, dayAt(0))
  await dayButtons(page).last().focus()
  await page.keyboard.press('ArrowLeft')
  await assertSelected(page, dayAt(-1))
  await expect(page.getByTestId('activity-calendar').locator(`button[data-date="${dayAt(-1)}"]`)).toBeFocused()
  await page.keyboard.press('Home')
  await assertSelected(page, dayAt(-6))
  await page.keyboard.press('End')
  await assertSelected(page, dayAt(0))
  await page.keyboard.press('ArrowUp')
  await assertSelected(page, dayAt(-7))
  await page.keyboard.press('ArrowLeft')
  await assertSelected(page, dayAt(-8))
  await expect(page.getByTestId('calendar-open')).toHaveAttribute('href', `/moments?date=${dayAt(-8)}`)
  const before = { ...calls }
  for (let index = 0; index < 12; index += 1) {
    const previous = page.getByTestId('calendar-previous')
    if (await previous.isDisabled()) break
    await previous.click()
  }
  await expect(page.getByTestId('calendar-previous')).toBeDisabled()
  await expect(dayButtons(page).first()).toHaveAttribute('data-date', dayAt(-83))
  assert.deepEqual(calls, before)
  // Return to the active date through keyboard navigation, then follow its link.
  for (let index = 0; index < 10; index += 1) await page.getByTestId('calendar-next').click()
  await page.getByTestId('activity-calendar').locator(`button[data-date="${dayAt(-8)}"]`).click()
  await page.getByTestId('calendar-open').click()
  await expect(page).toHaveURL(`${baseURL}/moments?date=${dayAt(-8)}`)
})

test('Home calendar keeps the selected week-end visible across resize without moving the page', async t => {
  const { page, calls } = await session(t, { design: 'voyage', width: 1440 })
  await ready(page)
  await assertSelected(page, dayAt(0))
  // Resize while reading elsewhere on the homepage. Revealing the selected day
  // must scroll only its strip, even when the calendar itself is off screen.
  await page.evaluate(() => {
    document.activeElement?.blur()
    scrollTo({ top: 0, behavior: 'instant' })
  })
  const before = { ...calls }
  for (const viewport of [{ width: 320, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport)
    await assertSelected(page, dayAt(0))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await page.evaluate(() => scrollY), 0, 'The calendar ResizeObserver does not scroll the page vertically')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  }
  assert.deepEqual(calls, before, 'Responsive reflow reuses the existing data')
})

test('An empty home calendar stays honest and zero GitHub activity remains valid data', async t => {
  const { page } = await session(t, { design: 'allotype', width: 320, dates: [], github: { reposCount: 0, monthCommits: 0, languages: [] } })
  await ready(page)
  await assertSelected(page, dayAt(0))
  await expect(page.getByTestId('calendar-overview').locator('g[data-date]')).toHaveCount(84)
  await expect(page.getByTestId('calendar-open')).toHaveCount(0)
  const github = page.getByTestId('activity-github')
  await expect(page.getByTestId('code-repositories')).toHaveText('0')
  await expect(page.getByTestId('code-commits')).toHaveText('0')
  await expect(github.getByRole('alert')).toHaveCount(0)
  assert(!/NaN|undefined|Infinity/.test(await github.innerText()))
  await appearance(page, 'ark.theme', 'dark')
  assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), 'dark')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})

test('GitHub loading and failure stay visible and Retry recovers the same activity block', async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  t.after(() => release())
  const { page, calls } = await session(t, {
    design: 'voyage', width: 320,
    githubHandler: async (route, attempt) => {
      if (attempt === 1) {
        await gate
        return route.fulfill({ status: 503, json: { message: 'Fixture: GitHub temporarily unavailable' } })
      }
      return route.fulfill({ json: { data: stats } })
    },
  })
  await ready(page, { waitUntil: 'domcontentloaded', refresh: false })
  const github = page.getByTestId('activity-github')
  await expect(github.getByRole('status')).toBeVisible()
  await expect(github).not.toContainText('128')
  release()
  await expect(github.getByRole('alert')).toContainText('Fixture: GitHub temporarily unavailable')
  await github.getByRole('button', { name: '重试', exact: true }).click()
  await expect(github).toContainText('128')
  await expect(github.getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('home-activity')).toHaveCount(1)
  assert.equal(calls.github, 2)
})

test('The four established themes do not gain a duplicate activity block or refetch on theme changes', async t => {
  const { page, calls } = await session(t, { design: 'archive' })
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  const before = { ...calls }
  for (const design of ['archive', 'rain', 'p3r', 'prism']) {
    await appearance(page, 'ark.design.v1', design)
    await expect(page.locator('html')).toHaveAttribute('data-design', design)
    await expect(page.getByTestId('home-activity')).toHaveCount(0)
  }
  for (const design of ['allotype', 'fold', 'voyage']) {
    await appearance(page, 'ark.design.v1', design)
    await expect(page.getByTestId('home-activity')).toBeVisible()
    await expect(page.getByTestId('home-activity')).toHaveCount(1)
  }
  assert.deepEqual(calls, before, 'Changing the presentation does not fetch the shared sources again')
})
