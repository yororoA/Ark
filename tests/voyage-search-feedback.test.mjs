import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:9999'
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
async function session(t) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(() => {
    if (window.top !== window) return
    for (const [key, value] of Object.entries({ 'ark.design.v1': 'voyage', 'ark.theme': 'light', 'ark.locale': 'zh', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  page.setDefaultTimeout(15000)
  await page.goto(`${baseURL}/articles`, { waitUntil: 'networkidle' })
  return { context, page, search: page.getByRole('searchbox'), results: page.locator('[data-article-search-results]'), feedback: page.locator('[data-article-search-feedback]') }
}
function gate(t) {
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  return { pending, release }
}
const isRsc = route => route.request().headers().rsc === '1'

test('An arriving search response preserves an unfinished new draft, while reset and history restore their conditions', async t => {
  const { context, page, search, results, feedback } = await session(t), hold = gate(t)
  await context.route('**/articles?**', async route => {
    if (isRsc(route) && new URL(route.request().url()).searchParams.get('keyword') === 'small') await hold.pending
    await route.continue()
  })
  await search.fill('small'); await search.press('Enter')
  await expect(results).toHaveAttribute('aria-busy', 'true')
  await search.fill('a new unfinished draft')
  hold.release()
  await page.waitForURL('**/articles?keyword=small')
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(search).toHaveValue('a new unfinished draft')
  await search.press('Enter')
  await page.waitForURL(url => url.searchParams.get('keyword') === 'a new unfinished draft')
  await expect(feedback.getByRole('status')).toHaveText('找到 0 篇文章')
  await search.fill('another unsent draft')
  await feedback.getByRole('button', { name: '重置所有条件' }).click()
  await page.waitForURL('**/articles')
  await expect(search).toHaveValue('')
  await page.goBack()
  await page.waitForURL(url => url.searchParams.get('keyword') === 'a new unfinished draft')
  await expect(search).toHaveValue('a new unfinished draft')
})

test('Search submits once, retains current articles while pending and restores filters through history', async t => {
  const { context, page, search, results, feedback } = await session(t), hold = gate(t)
  await expect(feedback).toHaveCount(0)
  let requests = 0
  await context.route('**/articles?**', async route => {
    if (isRsc(route) && new URL(route.request().url()).searchParams.has('keyword')) { requests++; await hold.pending }
    await route.continue()
  })
  await search.fill('unmatched-search-fixture')
  await page.waitForTimeout(200)
  assert.equal(requests, 0, 'Typing alone never requests results')
  await search.press('Enter')
  await expect(results).toHaveAttribute('aria-busy', 'true')
  await expect(feedback.getByRole('status')).toContainText('正在查找文章')
  await expect(results.locator('h2')).toContainText('A small record of time')
  assert.equal(await search.evaluate(element => document.activeElement === element), false, 'Submitting on mobile releases the keyboard')
  assert.equal(requests, 1)
  hold.release()
  await page.waitForURL('**/articles?keyword=unmatched-search-fixture')
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(feedback.getByRole('status')).toHaveText('找到 0 篇文章')
  await expect(results).toContainText('没有找到符合条件的记录。')
  await feedback.getByRole('button', { name: '重置所有条件' }).click()
  await page.waitForURL('**/articles')
  await expect(search).toHaveValue('')
  await expect(feedback.getByRole('status')).toHaveText('找到 1 篇文章')
  await page.goBack()
  await page.waitForURL('**/articles?keyword=unmatched-search-fixture')
  await expect(search).toHaveValue('unmatched-search-fixture')
  await expect(feedback.getByRole('status')).toHaveText('找到 0 篇文章')
  await page.getByRole('button', { name: '清除搜索', exact: true }).click()
  await page.waitForURL('**/articles')
  await expect(results.locator('h2')).toContainText('A small record of time')
})

test('A newer search and category selection supersede a slow earlier request', async t => {
  const { context, page, search, results, feedback } = await session(t), earlier = gate(t)
  let oldRequested = false
  await context.route('**/articles?**', async route => {
    if (isRsc(route) && new URL(route.request().url()).searchParams.get('keyword') === 'small') { oldRequested = true; await earlier.pending }
    await route.continue()
  })
  await search.fill('small'); await search.press('Enter')
  await expect.poll(() => oldRequested).toBe(true)
  await search.fill('newer-empty-query'); await search.press('Enter')
  await page.getByRole('button', { name: 'Life', exact: true }).click()
  await page.waitForURL(url => url.searchParams.get('keyword') === 'newer-empty-query' && url.searchParams.get('category') === 'Life')
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(feedback.getByRole('status')).toHaveText('找到 0 篇文章')
  earlier.release()
  await page.waitForTimeout(400)
  assert.equal(new URL(page.url()).searchParams.get('keyword'), 'newer-empty-query')
  assert.equal(new URL(page.url()).searchParams.get('category'), 'Life')
  await expect(search).toHaveValue('newer-empty-query')
  await expect(results.locator('h2')).toHaveCount(0)
})

test('An RSC transport failure recovers through Next navigation without a stuck search indicator', async t => {
  const { context, page, search, results, feedback } = await session(t), failure = gate(t)
  let failed = false
  await context.route('**/articles?**', async route => {
    if (!failed && isRsc(route) && new URL(route.request().url()).searchParams.get('keyword') === 'transport-empty-query') {
      failed = true; await failure.pending; await route.abort('failed'); return
    }
    await route.continue()
  })
  await search.fill('transport-empty-query'); await search.press('Enter')
  await expect(results).toHaveAttribute('aria-busy', 'true')
  failure.release()
  await page.waitForURL('**/articles?keyword=transport-empty-query')
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(feedback.getByRole('status')).toHaveText('找到 0 篇文章')
  await feedback.getByRole('button', { name: '重置所有条件' }).click()
  await page.waitForURL('**/articles')
  await expect(results.locator('h2')).toContainText('A small record of time')
})

test('A failed refresh keeps the previous list and exposes a working retry', async t => {
  const { context, page, search, results, feedback } = await session(t)
  await search.fill('small'); await search.press('Enter')
  await page.waitForURL('**/articles?keyword=small')
  let fail = true
  await context.route('**/api/blog/knowledge?**', async route => {
    if (fail) await route.fulfill({ status: 503, json: { message: '隔离测试：搜索服务暂不可用' } })
    else await route.continue()
  })
  const response = page.waitForResponse(response => response.url().includes('/api/blog/knowledge?') && response.status() === 503)
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await response
  await expect(results.getByRole('alert')).toContainText('隔离测试：搜索服务暂不可用')
  await expect(results.locator('h2')).toContainText('A small record of time')
  await expect(feedback.getByRole('status')).toHaveText('')
  fail = false
  await results.getByRole('button', { name: '重试', exact: true }).click()
  await expect(results.getByRole('alert')).toHaveCount(0)
  await expect(feedback.getByRole('status')).toHaveText('找到 1 篇文章')
})
