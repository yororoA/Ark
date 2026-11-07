import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mockAtlas, record, routeArticles, routeMoments, showAtlas } from './fixtures/voyage-atlas.mjs'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
async function session(t, { width = 1440, mode = 'light', locale = 'zh', timezoneId = 'Asia/Shanghai' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', timezoneId })
  t.after(() => context.close())
  await context.addInitScript(({ mode, locale }) => {
    localStorage.setItem('ark.design.v1', 'voyage'); localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', locale); localStorage.setItem('ark.mascot:v1', 'off')
  }, { mode, locale })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  page.setDefaultTimeout(12000)
  return { page, context }
}
async function load(page, reads, count) {
  await showAtlas(page, baseURL)
  await expect.poll(() => reads.articles > 0 && reads.moments > 0).toBe(true)
  await expect(page.getByRole('tab')).toHaveCount(count)
}
async function aligned(page, index) {
  const [point, marker] = await Promise.all([
    page.getByTestId(`voyage-stop-${index}`).locator('span').first().boundingBox(),
    page.getByTestId('voyage-route-beacon').boundingBox(),
  ])
  assert(point && marker && Math.hypot(point.x + point.width / 2 - marker.x - marker.width / 2, point.y + point.height / 2 - marker.y - marker.height / 2) < 1.5, 'The beacon and selected record share the same physical position')
}

test('The route is chronological, mixed, deduplicated and distinct from the remaining directory', async t => {
  const { page, context } = await session(t)
  const olderArticle = record('5', 'An older page', '2026-11-02T12:00:00Z')
  const olderMoment = record('6', 'An older observation', '2026-11-01T12:00:00Z')
  const oldestArticle = record('7', 'The earlier passage', '2026-10-31T12:00:00Z')
  const reads = await mockAtlas(context, [olderArticle, routeArticles[1], routeArticles[0], oldestArticle, routeArticles[0]], [olderMoment, ...routeMoments, routeArticles[0]])
  await load(page, reads, 4)
  const tabs = page.getByRole('tab'), directory = page.locator('#voyage-logbook [data-record-key]')
  const routeKeys = await tabs.evaluateAll(nodes => nodes.map(node => node.dataset.recordKey))
  assert.deepEqual(routeKeys, ['article:1', 'moment:2', 'article:3', 'moment:4'].map(key => key.replace(/:(\d)$/, (_, id) => `:${id.padStart(24, '0')}`)))
  const directoryKeys = await directory.evaluateAll(nodes => nodes.map(node => node.dataset.recordKey))
  assert.equal(directoryKeys.length, 3)
  assert.equal(new Set([...routeKeys, ...directoryKeys]).size, 7, 'Every real ID appears in either the route or the directory, never both')
  const before = { ...reads }
  await tabs.first().focus(); await page.keyboard.press('End')
  await expect(page.getByRole('tabpanel').getByRole('heading')).toHaveText('An earlier moment')
  await expect(page.getByRole('tabpanel').getByRole('link', { name: '打开这一页' })).toHaveAttribute('href', `/moments/${'4'.padStart(24, '0')}`)
  assert.deepEqual(await directory.evaluateAll(nodes => nodes.map(node => node.dataset.recordKey)), directoryKeys, 'Selection never rearranges the remaining directory')
  assert.deepEqual(reads, before, 'Choosing a record uses existing data')
})

for (const count of [1, 2, 4]) {
  test(`A ${count}-record route has exactly ${count} real stations and stays aligned through resize`, async t => {
    const { page, context } = await session(t)
    const pool = [routeArticles[0], routeMoments[0], routeArticles[1], routeMoments[1]].slice(0, count)
    const reads = await mockAtlas(context, pool.filter((_, index) => index % 2 === 0), pool.filter((_, index) => index % 2 === 1))
    await load(page, reads, count)
    await aligned(page, 0)
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      await aligned(page, 0)
      for (let index = 0; index < count; index++) {
        await page.getByTestId(`voyage-stop-${index}`).click()
        await expect(page.getByTestId(`voyage-stop-${index}`)).toHaveAttribute('aria-selected', 'true')
        await aligned(page, index)
      }
      await page.getByTestId('voyage-stop-0').click()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    await expect(page.locator('#voyage-logbook h2')).toHaveCount(0)
    await expect(page.locator('#voyage-logbook a')).toHaveCount(4)
    await expect(page.getByRole('button', { name: '下一段记录', exact: true })).toHaveCount(count === 1 ? 0 : 1)
    await expect(page.getByRole('button', { name: '上一段记录', exact: true })).toHaveCount(count === 1 ? 0 : 1)
  })
}

test('An empty route has no fabricated stations, counters or record previews', async t => {
  const { page, context } = await session(t, { width: 390 })
  const reads = await mockAtlas(context, [], [])
  await load(page, reads, 0)
  await expect(page.getByRole('tabpanel')).toHaveCount(0)
  await expect(page.getByTestId('voyage-route-beacon')).toHaveCount(0)
  await expect(page.getByTestId('voyage-home').getByRole('heading', { name: '下一段记录，从这里开始。' })).toBeVisible()
  await expect(page.locator('#voyage-logbook a')).toHaveCount(4)
  await expect(page.getByRole('region', { name: '文章', exact: true }).getByRole('status')).toBeVisible()
  await expect(page.getByRole('region', { name: '片刻', exact: true }).getByRole('status')).toBeVisible()
})

for (const width of [320, 390]) for (const mode of ['light', 'dark']) {
  test(`A normal record and its reading action are usable before the mobile fold: ${width}px ${mode}`, async t => {
    const { page, context } = await session(t, { width, mode })
    const first = record('1', '沿着河边，慢慢走回家', '2026-11-06T12:00:00Z', `![A real cover](${baseURL}/404.jpeg)\n\n天黑之前还剩一点时间，留给风、河流，以及途中没有说完的话。`)
    const reads = await mockAtlas(context, [first, routeArticles[1]], routeMoments)
    await load(page, reads, 4)
    const current = page.locator('[data-preview-layer="current"]')
    await expect(current.getByRole('heading')).toHaveText(first.title)
    const layout = await current.evaluate(element => {
      const title = element.querySelector('h2').getBoundingClientRect(), action = [...element.querySelectorAll('a')].at(-1)
      const open = action.getBoundingClientRect(), image = element.querySelector('img').getBoundingClientRect()
      const nav = document.querySelector('nav[class*="app-navigation"]').getBoundingClientRect()
      const hit = document.elementFromPoint(open.left + open.width / 2, open.top + open.height / 2)
      return { titleBottom: title.bottom, openTop: open.top, openBottom: open.bottom, imageTop: image.top, navTop: nav.top, scrollY, reachable: action === hit || action.contains(hit), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert.equal(layout.scrollY, 0)
    assert(layout.titleBottom <= layout.openTop && layout.openBottom < layout.navTop, 'The complete title and reading action precede the bottom bar')
    assert(layout.openBottom <= layout.imageTop, 'The cover follows the action instead of pushing reading off the first screen')
    assert.equal(layout.reachable, true)
    assert.equal(layout.overflow, false)
  })
}

test('Record dates use one timezone and empty titles fall back to actual text', async t => {
  const { page, context } = await session(t, { timezoneId: 'Asia/Shanghai' })
  const first = record('1', '', '2026-11-05T23:30:00Z', '凌晨走过桥边，看见河上的灯。')
  const reads = await mockAtlas(context, [first], [])
  await load(page, reads, 1)
  await expect(page.getByRole('tab').locator('time')).toHaveText('11.06')
  await expect(page.getByRole('tabpanel').locator('time')).toHaveText('2026年11月06日')
  await expect(page.getByRole('tabpanel').getByRole('heading')).toHaveText(first.content)
})
