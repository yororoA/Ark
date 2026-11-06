import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Start the isolated, in-memory preview; all writes below are intercepted in the browser.
// ARK_VERIFY_PORT=10560 node scripts/verify-blog.mjs --serve
// TEST_BASE_URL=http://127.0.0.1:10560 node --test tests/voyage-about.test.mjs
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
assert.match(baseURL, /^http:\/\/127\.0\.0\.1:\d{4,5}$/, 'About checks require an isolated local preview')
const artifacts = process.env.ARK_ABOUT_ARTIFACTS
const firstLink = { _id: 'fixture-link-1', name: 'Project source', url: 'https://github.com/yororoA/Ark', category: 'friend' }
const firstLetter = { _id: 'fixture-letter-1', username: 'A reader', content: 'A quiet place to return to.', createdAt: '2026-11-06T10:00:00Z' }
let browser
before(async () => { browser = await chromium.launch({ headless: true }); if (artifacts) await mkdir(artifacts, { recursive: true }) })
after(async () => browser?.close())

async function session(t, { width = 1440, mode = 'light', locale = 'zh', design = 'voyage', admin = false, long = false, letters = [], links = [firstLink], motion = 'reduce', slow = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 }, colorScheme: mode, reducedMotion: motion })
  t.after(() => context.close())
  await context.addInitScript(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value) }, {
    'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': locale, 'ark.mascot:v1': 'off',
  })
  const controls = { postDelay: 250, links: [...links], letters: [...letters], writes: [], unexpected: [], failRead: false, failPost: false, reads: [] }
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(release)
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const ok = data => route.fulfill({ json: { data, success: true } })
    if (path === '/api/session') return route.fulfill({ json: url.searchParams.has('all') ? { data: [], activeUid: null } : { data: admin ? { uid: 'fixture-admin', username: 'Fixture editor', isAdmin: true, isGuest: false } : null } })
    if (path.endsWith('/sse/subscribe')) return route.fulfill({ contentType: 'text/event-stream', body: ': isolated\n\n' })
    if (path === '/api/blog/about') return ok({ author: long ? 'YororoIceWithAnUnbrokenNameToTestTheNarrowestViewport' : 'YororoIce', ...(long ? { bio: 'A long biography with **real Markdown formatting**.\n\nhttps://example.com/' + 'long-path-'.repeat(12), skills: ['TypeScript', 'AnUnbrokenToolName'.repeat(4)], interests: ['Reading', 'Long interest '.repeat(12)] } : {}) })
    if (path === '/api/blog/links') {
      if (slow) await pending
      if (controls.failRead) return route.fulfill({ status: 503, json: { message: 'Fixture address list unavailable' } })
      return ok(controls.links)
    }
    if (path === '/api/blog/guestbook') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); controls.writes.push({ path, method: 'POST', body })
        await new Promise(resolve => setTimeout(resolve, controls.postDelay))
        if (controls.failPost) return route.fulfill({ status: 503, json: { message: 'Fixture message rejected' } })
        controls.letters.unshift({ ...firstLetter, ...body, _id: 'posted-letter' }); return ok(controls.letters[0])
      }
      if (slow) await pending
      const page = +(url.searchParams.get('page') || 1); controls.reads.push(page)
      if (controls.failRead) return route.fulfill({ status: 503, json: { message: 'Fixture guestbook unavailable' } })
      return route.fulfill({ json: { data: controls.letters.slice((page - 1) * 8, page * 8), pagination: { page, pages: Math.ceil(controls.letters.length / 8) }, success: true } })
    }
    if (path.startsWith('/api/blog/admin/links')) {
      const body = request.postDataJSON(); controls.writes.push({ path, method: request.method(), body })
      if (request.method() === 'POST') controls.links.push({ ...body, _id: 'added-link' })
      if (request.method() === 'PUT') controls.links = controls.links.map(link => path.endsWith(link._id) ? { ...link, ...body } : link)
      if (request.method() === 'DELETE') controls.links = controls.links.filter(link => !path.endsWith(link._id))
      return ok({})
    }
    if (request.method() !== 'GET') { controls.unexpected.push(path); return ok({}) }
    return route.continue()
  })
  // External link icons must never be fetched from the live internet by this fixture.
  await context.route('https://fixture.invalid/**', route => route.fulfill({ status: 404, body: 'Fixture missing icon' }))
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(controls.unexpected, []) })
  await page.goto(`${baseURL}/about`, { waitUntil: slow ? 'domcontentloaded' : 'networkidle' })
  await expect(page.getByRole('heading', { name: long ? /YororoIceWith/ : 'YororoIce', exact: !long })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { page, controls, release }
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
}
async function shot(page, name) {
  if (!artifacts) return
  await page.screenshot({ path: `${artifacts}/${name}-full.png`, fullPage: true })
  await page.screenshot({ path: `${artifacts}/${name}-top.png` })
  await page.locator('#guestbook').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${artifacts}/${name}-guestbook.png` })
}
for (const width of [1440, 390, 320]) for (const mode of ['light', 'dark']) test(`About correspondence layout ${width}px ${mode}`, async t => {
  const { page } = await session(t, { width, mode })
  await noOverflow(page)
  await expect(page.locator('#voyage-connections-title')).toBeVisible()
  await expect(page.locator('#guestbook').getByText('这一页，尚待落笔。')).toBeVisible()
  const channels = page.locator('[aria-label="站外联系"] a')
  await expect(channels).toHaveCount(4)
  assert.ok((await channels.first().boundingBox()).height >= 44)
  assert.equal(await page.locator('[data-about-rule]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node, '::before').animationName === 'none')), true)
  await shot(page, `about-${width}-${mode}`)
})
for (const locale of ['zh', 'en', 'ja', 'de']) test(`Long content and missing icons remain readable in ${locale} at 320px`, async t => {
  const links = [{ ...firstLink, name: 'A very long linked publication '.repeat(3), url: 'https://example.com/' + 'unbroken'.repeat(25), description: 'A readable long description. '.repeat(10), imgurl: 'https://fixture.invalid/icon.png' }, { ...firstLink, _id: 'link-2', name: 'Short link', category: 'tool' }, { ...firstLink, _id: 'unsafe', name: 'Unsafe destination', url: 'javascript:alert(1)' }]
  const { page } = await session(t, { width: 320, mode: 'dark', locale, long: true, links, letters: [{ ...firstLetter, username: 'LongUnbrokenDisplayName'.repeat(4), content: 'LongUnbrokenMessage'.repeat(30) + '\nSecond line.' }] })
  await noOverflow(page)
  await expect(page.getByRole('link', { name: /Unsafe destination/ })).toHaveCount(0)
  assert.equal(await page.locator('img[src="https://fixture.invalid/icon.png"]').count(), 0)
  await expect(page.locator('#guestbook textarea')).toHaveCSS('font-size', '16px')
  if (locale === 'de') await shot(page, 'about-320-dark-long-de')
})
test('Keyboard categories, administrator editor and delete confirmation retain their actions', async t => {
  const { page, controls } = await session(t, { admin: true, links: [firstLink, { ...firstLink, _id: 'tool-link', name: 'Tool destination', category: 'tool' }] })
  const filters = page.locator('[aria-label="链接分类"]')
  await filters.getByRole('button', { name: '工具', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(filters.getByRole('button', { name: '工具', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Tool destination', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Project source', exact: true })).toHaveCount(0)
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none')
  await filters.getByRole('button', { name: '全部', exact: true }).click()
  await page.getByRole('button', { name: '编辑 Project source', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('标题', { exact: true }).fill('Edited project source')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Edited project source', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '删除 Edited project source', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edited project source', exact: true })).toHaveCount(0)
  assert.deepEqual(controls.writes.map(write => write.method), ['PUT', 'DELETE'])
})
test('Guestbook preserves failed drafts, refreshes after success and returns from pagination', async t => {
  const letters = Array.from({ length: 9 }, (_, index) => ({ ...firstLetter, _id: `letter-${index}`, content: `Fixture letter ${index + 1}` }))
  const { page, controls } = await session(t, { width: 390, letters })
  const section = page.locator('#guestbook'), input = section.getByRole('textbox', { name: '内容', exact: true }), send = section.getByRole('button', { name: '发送', exact: true })
  await section.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(section.getByText('Fixture letter 9', { exact: true })).toBeVisible()
  await input.fill('A message from the isolated browser fixture.')
  await section.getByLabel('你的名字', { exact: true }).fill('Test reader')
  controls.failPost = true
  await send.click()
  await expect(section.getByRole('alert')).toContainText('Fixture message rejected')
  await expect(input).toHaveValue('A message from the isolated browser fixture.')
  controls.failPost = false
  await send.click()
  await expect(input).toHaveValue('')
  await expect(section.getByText('A message from the isolated browser fixture.', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: '上一页', exact: true })).toBeDisabled()
  assert.equal(controls.writes.length, 2)
  assert.deepEqual(controls.writes[1].body, { username: 'Test reader', content: 'A message from the isolated browser fixture.' })
  await noOverflow(page)
})
test('Loading, failed reads and retry stay within the correspondence columns', async t => {
  const { page, controls, release } = await session(t, { width: 320, slow: true })
  await expect(page.getByRole('status').filter({ hasText: '载入' }).first()).toBeVisible()
  controls.failRead = true; release()
  await expect(page.getByRole('alert').filter({ hasText: 'Fixture address list unavailable' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Fixture guestbook unavailable' })).toBeVisible()
  await noOverflow(page)
  controls.failRead = false
  await page.getByRole('alert').filter({ hasText: 'Fixture address list unavailable' }).getByRole('button').click()
  await page.getByRole('alert').filter({ hasText: 'Fixture guestbook unavailable' }).getByRole('button').click()
  await expect(page.getByRole('heading', { name: 'Project source', exact: true })).toBeVisible()
  await expect(page.getByText('这一页，尚待落笔。')).toBeVisible()
})
test('Section rules finish once, keep content visible, and honor a live reduced-motion change', async t => {
  const { page } = await session(t, { motion: 'no-preference' })
  const channels = page.locator('[aria-label="站外联系"]')
  await expect(channels).toHaveAttribute('data-about-rule', 'visible')
  await expect(page.locator('#voyage-author-title')).toHaveCSS('opacity', '1')
  await page.waitForTimeout(650)
  assert.equal(await channels.evaluate(node => node.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')), false)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('[data-about-rule]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node, '::before').animationName === 'none')), true)
})
test('Other themes retain the shared About structure', async t => {
  const { page } = await session(t, { design: 'archive', width: 390 })
  await expect(page.locator('#voyage-author-title')).toHaveCount(0)
  await expect(page.locator('[class*="about-intro"]')).toBeVisible()
  await expect(page.locator('#guestbook textarea')).toBeVisible()
  await noOverflow(page)
})

test('A delayed successful send preserves words typed for the next message', async t => {
  const { page, controls } = await session(t, { width: 320 })
  controls.postDelay = 800
  const section = page.locator('#guestbook'), input = section.getByRole('textbox', { name: '内容', exact: true })
  await input.fill('The submitted message.')
  await section.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => controls.writes.length).toBe(1)
  await input.fill('A new draft while the request is pending.')
  await expect(section.getByText('The submitted message.', { exact: true })).toBeVisible()
  await expect(input).toHaveValue('A new draft while the request is pending.')
})
test('Entry rules wait until the route curtain is gone and stop when the page hides', async t => {
  const { page } = await session(t, { width: 390, motion: 'no-preference' })
  const channels = page.locator('#guestbook')
  await page.evaluate(() => { document.documentElement.dataset.voyageWipe = 'covered' })
  await channels.scrollIntoViewIfNeeded()
  await expect(channels).toHaveAttribute('data-about-rule', 'waiting')
  await expect(page.locator('#voyage-author-title')).toHaveCSS('opacity', '1')
  await page.evaluate(() => { delete document.documentElement.dataset.voyageWipe })
  await expect(channels).toHaveAttribute('data-about-rule', 'visible')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(channels).toHaveAttribute('data-about-rule', '')
  assert.equal(await channels.evaluate(node => getComputedStyle(node, '::before').animationName), 'none')
})

test('A narrow administrator can recover from an empty category and add a real address', async t => {
  const { page, controls } = await session(t, { width: 320, mode: 'dark', admin: true })
  const filters = page.getByRole('group', { name: '链接分类' })
  await filters.getByRole('button', { name: '其他', exact: true }).click()
  await expect(page.getByText('还没有这一类地址。')).toBeVisible()
  await page.getByRole('button', { name: '添加链接', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('标题', { exact: true }).fill('Added fixture address')
  await dialog.getByLabel('链接地址', { exact: true }).fill('https://example.com/fixture')
  await noOverflow(page)
  if (artifacts) await page.screenshot({ path: `${artifacts}/about-320-dark-admin.png` })
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await filters.getByRole('button', { name: '全部', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Added fixture address', exact: true })).toBeVisible()
  assert.deepEqual(controls.writes.map(write => write.method), ['POST'])
})
