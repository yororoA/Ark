import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10580'
if (!/^http:\/\/127\.0\.0\.1:(10580|10590)$/.test(baseURL)) throw new Error('Comment checks require an isolated local fixture')
const artifacts = process.env.ARK_COMMENT_ARTIFACTS
const momentId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const first = { _id: 'cccccccccccccccccccccccc', uid: 'other', username: '窗边的读者', content: '夜里翻到这篇记录，很喜欢这些普通日子里的细节。', createdAt: '2026-11-05T13:20:00Z', likes: 2 }
const postedId = 'dddddddddddddddddddddddd'
let browser
before(async () => { browser = await chromium.launch({ headless: true }); if (artifacts) await mkdir(artifacts, { recursive: true }) })
after(async () => browser?.close())

async function session(t, { width = 320, mode = 'dark', design = 'voyage', failPost = false, failRefresh = '' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 780 : 1000 }, colorScheme: mode, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(({ mode, design }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': 'zh', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
  }, { mode, design })
  const controls = { failPost, failRefresh, posts: [], reads: [], posted: null, unexpectedWrites: [] }
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = data => route.fulfill({ json: data })
    if (path === '/api/session') return json(url.searchParams.has('all') ? { data: [], activeUid: null } : { data: { uid: 'reviewer', username: '审视用账号', isGuest: false, isAdmin: false } })
    if (path.endsWith('/liked')) return json({ data: [] })
    if (path.endsWith('/sse/subscribe')) return route.fulfill({ contentType: 'text/event-stream', body: ': isolated fixture\n\n' })
    if (path === '/api/blog/moments/comment/get') {
      const body = request.postDataJSON()
      controls.reads.push(body.commentIds)
      if (controls.posted && controls.failRefresh === 'comments') return route.fulfill({ status: 503, json: { message: 'Fixture comment list unavailable' } })
      return json({ message: 'ok', data: [first, controls.posted].filter(item => item && body.commentIds.includes(item._id)) })
    }
    if (path === '/api/blog/moments/comment/post') {
      const body = request.postDataJSON()
      controls.posts.push(body)
      await Promise.all([pending, new Promise(resolve => setTimeout(resolve, 800))])
      if (controls.failPost) return route.fulfill({ status: 503, json: { message: 'Fixture comment rejected' } })
      controls.posted = { ...first, _id: postedId, uid: 'reviewer', username: '审视用账号', content: body.comment, belong: body.belong, createdAt: '2026-11-06T13:20:00Z' }
      return json({ message: 'ok', data: controls.posted })
    }
    if (path === `/api/blog/moments/${momentId}` && request.method() === 'GET' && controls.posted) {
      if (controls.failRefresh === 'moment') return route.fulfill({ status: 503, json: { message: 'Fixture moment unavailable' } })
      const response = await route.fetch(), data = await response.json()
      data.data.comments = [first._id, postedId]
      return route.fulfill({ response, json: data })
    }
    if (path === '/api/blog/moments/view') return json({ data: { views: 13 } })
    if (request.method() !== 'GET') { controls.unexpectedWrites.push(path); return json({ data: {} }) }
    return route.continue()
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(controls.unexpectedWrites, []) })
  await page.goto(`${baseURL}/moments/${momentId}`, { waitUntil: 'networkidle' })
  const section = page.locator('#comments'), input = section.locator('textarea'), receipt = page.getByTestId('comment-receipt')
  await expect(section.locator(`#comment-${first._id}`)).toBeVisible()
  await expect(input).toBeEnabled()
  const send = section.getByRole('button', { name: '发送', exact: true })
  async function reply() { await section.locator(`#comment-${first._id}`).getByRole('button', { name: '回复', exact: true }).click() }
  return { page, section, input, receipt, send, reply, controls, release }
}

for (const [width, mode] of [[320, 'dark'], [1440, 'light']]) test(`Comment success clears its draft and offers an explicit accessible anchor: ${width}px ${mode}`, async t => {
  const { page, section, input, receipt, send, reply, controls, release } = await session(t, { width, mode })
  await reply()
  await input.fill('这段夜航记录已经送达。')
  await send.click()
  await expect.poll(() => controls.posts.length).toBe(1)
  await page.evaluate(() => {
    window.__commentScrollTargets = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (...args) { window.__commentScrollTargets.push(this.id); return original.apply(this, args) }
  })
  release()
  await expect(receipt.getByRole('status')).toHaveText('评论已发送。')
  await expect(input).toHaveValue('')
  await expect(section.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)
  const link = receipt.getByRole('link', { name: '查看评论', exact: true })
  await expect(link).toHaveAttribute('href', `#comment-${postedId}`)
  assert.deepEqual(controls.posts, [{ momentId, comment: '这段夜航记录已经送达。', belong: first._id }])
  assert.ok(controls.reads.some(ids => ids.includes(postedId)), 'The list cache key follows the refreshed comment IDs')
  assert.equal(controls.reads.length, 2, 'Initial comments and the explicit refresh are each read once')
  assert.equal(new URL(page.url()).hash, '')
  assert.equal(await page.evaluate(id => window.__commentScrollTargets.includes(`comment-${id}`), postedId), false)
  assert.equal(await page.evaluate(id => document.activeElement?.id === `comment-${id}`, postedId), false)
  await receipt.scrollIntoViewIfNeeded()
  if (artifacts) await page.screenshot({ path: `${artifacts}/comment-receipt-${width}-${mode}.png` })
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`#comment-${postedId}$`))
  await expect(section.locator(`#comment-${postedId}`)).toBeFocused()
  const bounds = await section.locator(`#comment-${postedId}`).evaluate(element => ({ top: element.getBoundingClientRect().top, header: document.querySelector('[data-blog-root] > header')?.getBoundingClientRect().bottom || 0 }))
  assert.ok(bounds.top >= bounds.header - 1, 'Explicit comment anchor stays below the fixed header')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})

test('Typing a new draft during an 800ms send preserves the new draft and reply selection', async t => {
  const { input, receipt, send, reply, section, controls, release } = await session(t)
  await input.fill('先送出的评论。')
  await send.click()
  await expect.poll(() => controls.posts.length).toBe(1)
  await input.fill('下一条还没有发送的新草稿。')
  await reply()
  release()
  await expect(receipt.getByRole('status')).toHaveText('评论已发送。')
  await expect(input).toHaveValue('下一条还没有发送的新草稿。')
  await expect(section.getByRole('button', { name: '取消', exact: true })).toBeVisible()
  assert.deepEqual(controls.posts, [{ momentId, comment: '先送出的评论。' }])
})

test('Changing only the reply target during sending preserves the unfinished reply', async t => {
  const { input, receipt, send, reply, section, controls, release } = await session(t)
  await input.fill('提交期间选择了新的回复对象。')
  await send.click()
  await expect.poll(() => controls.posts.length).toBe(1)
  await reply()
  release()
  await expect(receipt.getByRole('status')).toHaveText('评论已发送。')
  await expect(input).toHaveValue('提交期间选择了新的回复对象。')
  await expect(section.getByRole('button', { name: '取消', exact: true })).toBeVisible()
  assert.equal(controls.posts[0].belong, undefined)
})

test('A failed comment keeps draft and reply target and has no sent receipt', async t => {
  const { input, receipt, send, reply, section, release } = await session(t, { failPost: true })
  await reply()
  await input.fill('网络失败时应当保留这段文字。')
  await send.click()
  release()
  await expect(section.getByRole('alert')).toHaveText('Fixture comment rejected')
  await expect(input).toHaveValue('网络失败时应当保留这段文字。')
  await expect(section.getByRole('button', { name: '取消', exact: true })).toBeVisible()
  await expect(receipt).toHaveCount(0)
  await expect(send).toBeEnabled()
})

for (const failure of ['moment', 'comments']) test(`A sent comment survives ${failure} refresh failure and retries only the list`, async t => {
  const { page, input, receipt, send, controls, release } = await session(t, { failRefresh: failure })
  await input.fill('已发送的内容无需再次提交。')
  await send.click()
  release()
  await expect(receipt.getByRole('status')).toHaveText('评论已发送，列表暂未更新。')
  await expect(input).toHaveValue('')
  await expect(page.locator(`#comment-${first._id}`)).toBeVisible()
  const retry = receipt.getByRole('button', { name: '刷新评论', exact: true })
  await expect(retry).toBeEnabled()
  if (artifacts) { await receipt.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${artifacts}/comment-refresh-${failure}-320-dark.png` }) }
  controls.failRefresh = ''
  await retry.click()
  await expect(receipt.getByRole('status')).toHaveText('评论已发送。')
  await expect(receipt.getByRole('link', { name: '查看评论', exact: true })).toBeVisible()
  assert.equal(controls.posts.length, 1, 'Refreshing never repeats the successful write')
  assert.equal(controls.reads.length, failure === 'moment' ? 2 : 3, 'Retry reads only the missing snapshot without a duplicate list fetch')
})

test('Archive theme keeps the shared receipt and draft behavior without layout overflow', async t => {
  const { page, input, receipt, send, release } = await session(t, { design: 'archive', mode: 'light' })
  await input.fill('其他主题也保留清楚的发送反馈。')
  await send.click()
  release()
  await expect(receipt.getByRole('status')).toHaveText('评论已发送。')
  await expect(receipt.getByRole('link', { name: '查看评论', exact: true })).toBeVisible()
  await expect(input).toHaveValue('')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})
