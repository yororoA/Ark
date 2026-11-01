import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const shots = process.env.THEME_SCREENSHOT_DIR
const designNames = { archive: '档案', rain: '青笺', p3r: 'P3R', prism: '月之暗面', allotype: '异相' }
const modeNames = { light: '浅色', dark: '深色', system: '跟随系统' }
let browser

before(async () => {
  browser = await chromium.launch({ headless: true })
  if (shots) await mkdir(shots, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 1000 },
    hasTouch: width <= 640,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  })
  t.after(() => context.close())
  await context.addInitScript(() => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    // Defaults only: a real reload must preserve the user's selected values.
    for (const [key, value] of Object.entries({
      'ark.design.v1': 'archive', 'ark.theme': 'light', 'ark.locale': 'zh', 'ark.mascot:v1': 'off',
    })) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    }
  })
  // An anonymous, isolated account state exercises the first-login dialog
  // without creating accounts or submitting credentials to a real service.
  await context.route('**/api/session**', route => route.fulfill({
    json: new URL(route.request().url()).searchParams.has('all')
      ? { data: [], activeUid: null }
      : { data: null },
  }))
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { page, context }
}

async function ready(page) {
  await page.getByTestId('theme-page').waitFor()
  await page.evaluate(() => document.fonts.ready)
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), page.viewportSize().width,
    'Theme page must not create horizontal page scrolling')
  const failures = await page.getByTestId('theme-page').locator('h1,h2,label,button,a').evaluateAll(elements =>
    elements.flatMap(element => {
      const r = element.getBoundingClientRect()
      return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1)
        ? [{ tag: element.tagName, text: element.textContent?.slice(0, 60), left: r.left, right: r.right }]
        : []
    }))
  assert.deepEqual(failures, [], 'Theme labels and controls stay within the viewport')
}

async function choose(page, value) {
  const gallery = page.getByTestId('theme-page')
  await gallery.locator(`label:has(input[value="${value}"])`).click()
  await expect(gallery.locator(`input[value="${value}"]`)).toBeChecked()
}

async function draftSession(t, width = 1440) {
  const { page, context } = await session(t, width)
  await context.unroute('**/api/session**')
  const username = `theme-draft-${Date.now()}`
  async function login(name) {
    const response = await context.request.post(`${baseURL}/api/auth/login`, {
      data: { username: name, password: 'fixture-password' },
    })
    assert.equal(response.status(), 200, 'Only use the isolated in-memory preview fixture')
  }
  await login(username)
  await context.route('**/api/blog/sse/subscribe', route => route.fulfill({
    contentType: 'text/event-stream', body: 'retry: 600000\n: draft navigation fixture\n\n',
  }))
  const writes = []
  await context.route('**/api/blog/**', route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.fallback()
    writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
    return route.fulfill({ status: 409, json: { message: 'This test must not publish or send content' } })
  })
  t.after(() => assert.deepEqual(writes, [], 'Draft navigation never submits content'))
  async function switchAccount(name) {
    await login(name)
    await page.evaluate(() => window.dispatchEvent(new Event('ark:session-invalid')))
    await expect(page.locator('[class*="account-links"] > span')).toHaveText(name)
  }
  return { page, context, username, switchAccount }
}

for (const width of [320, 390, 1440]) {
  test(`theme page: ${width}px preserves the source query and keeps all choices reachable`, async t => {
    const { page } = await session(t, width)
    const source = '/articles?category=Development&q=record'
    await page.goto(`${baseURL}${source}`)
    await page.getByRole('link', { name: '外观', exact: true }).click()
    await ready(page)
    const url = new URL(page.url())
    assert.equal(url.pathname, '/theme')
    assert.equal(url.searchParams.get('returnTo'), source)
    const gallery = page.getByTestId('theme-page')
    await expect(gallery.locator('input[type="radio"]')).toHaveCount(8)
    await noOverflow(page)
    for (const [value, name] of Object.entries({ ...designNames, ...modeNames })) {
      const radio = gallery.getByRole('radio', { name, exact: true })
      await expect(radio).toHaveCount(1)
      const label = gallery.locator(`label:has(input[value="${value}"])`)
      await label.scrollIntoViewIfNeeded()
      const r = await label.boundingBox()
      assert(r.y >= -1 && r.y + r.height <= page.viewportSize().height + 1, `${name} can be scrolled into view`)
    }
    await choose(page, 'allotype')
    await expect(page.locator('html')).toHaveAttribute('data-design', 'allotype')
    await noOverflow(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    if (shots) await page.screenshot({ path: `${shots}/theme-page-${width}.png` })
    const back = gallery.getByRole('link', { name: '返回原页面', exact: true })
    await expect(back).toHaveAttribute('href', source)
    await back.click()
    await expect(page).toHaveURL(`${baseURL}${source}`)
    await expect(gallery).toHaveCount(0)
    if (width <= 640) {
      // The contextual phone Back link is a second working return path.
      await page.getByRole('link', { name: '外观', exact: true }).click()
      await ready(page)
      const headerBack = page.locator('header[class*="site-header"]').locator(`a[href="${source}"]`)
      await expect(headerBack).toBeVisible()
      await headerBack.click()
      await expect(page).toHaveURL(`${baseURL}${source}`)
    }
  })
}

test('theme page: five themes, three modes, native radio keys and reload persistence', async t => {
  const { page } = await session(t)
  await page.goto(`${baseURL}/theme?returnTo=%2Fhome`)
  await ready(page)
  const gallery = page.getByTestId('theme-page')
  for (const value of Object.keys(designNames)) {
    await choose(page, value)
    await expect(page.locator('html')).toHaveAttribute('data-design', value)
    await noOverflow(page)
  }
  for (const value of Object.keys(modeNames)) {
    await choose(page, value)
    await expect(page.locator('html')).toHaveAttribute('data-theme', value)
    await noOverflow(page)
  }
  await choose(page, 'archive')
  await gallery.getByRole('radio', { name: '档案', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(gallery.getByRole('radio', { name: '青笺', exact: true })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'rain')
  await choose(page, 'light')
  await gallery.getByRole('radio', { name: '浅色', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(gallery.getByRole('radio', { name: '深色', exact: true })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await choose(page, 'allotype')
  assert.deepEqual(await page.evaluate(() => ({
    design: localStorage.getItem('ark.design.v1'), mode: localStorage.getItem('ark.theme'),
  })), { design: 'allotype', mode: 'dark' })
  await page.reload()
  await ready(page)
  await expect(page.locator('html')).toHaveAttribute('data-design', 'allotype')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(gallery.getByRole('radio', { name: '异相', exact: true })).toBeChecked()
  await expect(gallery.getByRole('radio', { name: '深色', exact: true })).toBeChecked()
  await gallery.getByRole('link', { name: '返回原页面', exact: true }).click()
  await expect(page).toHaveURL(`${baseURL}/home`)
  await expect(page.getByTestId('allotype-home')).toBeVisible()
})

test('theme page: first-login account dialog can open appearance and return to its original destination', async t => {
  const { page } = await session(t, 390)
  const source = '/login?returnTo=%2Farticles%3Fq%3Drecord'
  await page.goto(`${baseURL}${source}`)
  const account = page.getByRole('dialog', { name: '账号管理', exact: true })
  await expect(account).toBeVisible()
  await account.getByRole('link', { name: '外观', exact: true }).click()
  await ready(page)
  assert.equal(new URL(page.url()).searchParams.get('returnTo'), source)
  await expect(account).toHaveCount(0)
  assert.equal(await page.getByTestId('theme-page').evaluate(el => el.closest('[inert]') !== null), false)
  await choose(page, 'prism')
  await page.getByTestId('theme-page').getByRole('link', { name: '返回原页面', exact: true }).click()
  await expect(page).toHaveURL(`${baseURL}${source}`)
  await expect(account).toBeVisible()
  await account.locator('#username').fill('theme-return-check')
  await expect(account.locator('#username')).toHaveValue('theme-return-check')
  await expect(account.getByRole('link', { name: '外观', exact: true })).toBeVisible()
})

test('theme page: unsafe external return targets fall back to home', async t => {
  const { page } = await session(t, 320)
  for (const target of ['https://example.invalid/outside', '//example.invalid/outside']) {
    await page.goto(`${baseURL}/theme?returnTo=${encodeURIComponent(target)}`)
    await ready(page)
    const back = page.getByTestId('theme-page').getByRole('link', { name: '返回原页面', exact: true })
    await expect(back).toHaveAttribute('href', '/home')
    await back.click()
    await expect(page).toHaveURL(`${baseURL}/home`)
  }
})

test('theme page: article draft fields and queued file survive return and stay isolated by account', async t => {
  const { page, username, switchAccount } = await draftSession(t)
  await page.goto(`${baseURL}/articles/new`)
  const fields = {
    标题: 'Unsubmitted theme round trip',
    '内容 / Markdown': '## Still here\n\n正文、Markdown **emphasis** and a second paragraph.',
    分类: 'Theme verification',
    '标签（逗号分隔）': 'draft, theme, 未发布',
  }
  for (const [name, value] of Object.entries(fields)) await page.getByRole('textbox', { name, exact: true }).fill(value)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'theme-draft.png', mimeType: 'image/png', buffer: await readFile(new URL('../public/logo.png', import.meta.url)),
  })
  async function openTheme() {
    await page.getByRole('link', { name: '外观', exact: true }).click()
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/articles/new')
  }
  async function returnToDraft() {
    await page.getByTestId('theme-page').getByRole('link', { name: '返回原页面', exact: true }).click()
    await expect(page).toHaveURL(`${baseURL}/articles/new`)
  }
  async function expectDraft() {
    for (const [name, value] of Object.entries(fields)) await expect(page.getByRole('textbox', { name, exact: true })).toHaveValue(value)
    await expect(page.getByText('theme-draft.png', { exact: true })).toBeVisible()
  }
  await openTheme()
  await choose(page, 'prism')
  await returnToDraft()
  await expectDraft()

  // Account changes occur away from the editor, within the same tab: an empty
  // new account must not inherit the previous account's module-memory draft.
  await openTheme()
  await switchAccount(`${username}-empty`)
  await returnToDraft()
  for (const name of Object.keys(fields)) await expect(page.getByRole('textbox', { name, exact: true })).toHaveValue('')
  await expect(page.getByText('theme-draft.png', { exact: true })).toHaveCount(0)
  await openTheme()
  await switchAccount(username)
  await returnToDraft()
  await expectDraft()
})

test('theme page: chat text and reply survive return to the selected conversation query', async t => {
  const { page, context } = await draftSession(t, 390)
  const conversation = 'theme-peer'
  await context.route('**/api/blog/chat/conversations?*', route => route.fulfill({ json: { data: [
    { id: 'group', type: 'group' }, { id: conversation, type: 'private', label: 'Theme peer' },
  ] } }))
  await context.route('**/api/blog/chat/history?*', route => route.fulfill({ json: { data: [{
    _id: 'theme-reply-message', uid: conversation, username: 'Theme peer',
    text: 'A controlled message to quote', createdAt: '2026-10-31T10:00:00Z',
  }], hasMore: false } }))
  const source = `/chat?conversation=${conversation}`
  await page.goto(`${baseURL}${source}`)
  const compose = page.locator('form[class*="chat-compose"]')
  await compose.getByRole('textbox').fill('Unsent message retained while changing appearance')
  await page.getByRole('log').getByRole('button', { name: '回复 Theme peer', exact: true }).click()
  const reply = await compose.locator('[class*="reply-target"]').innerText()
  await page.getByRole('link', { name: '外观', exact: true }).click()
  await ready(page)
  assert.equal(new URL(page.url()).searchParams.get('returnTo'), source)
  await choose(page, 'dark')
  await page.getByTestId('theme-page').getByRole('link', { name: '返回原页面', exact: true }).click()
  await expect(page).toHaveURL(`${baseURL}${source}`)
  await expect(page.locator('[data-chat-view="thread"]')).toBeVisible()
  await expect(compose.getByRole('textbox')).toHaveValue('Unsent message retained while changing appearance')
  await expect(compose.locator('[class*="reply-target"]')).toHaveText(reply)
})

test('theme page: hash return survives direct entry and a same-page Next anchor change', async t => {
  const { page } = await session(t)
  for (const samePageAnchor of [false, true]) {
    await page.goto(`${baseURL}/about#${samePageAnchor ? 'main-content' : 'guestbook'}`)
    await expect(page.locator('#guestbook')).toBeVisible()
    if (samePageAnchor) {
      // This is the real footer Next Link: it changes the hash through
      // pushState without requiring a native hashchange event.
      await page.locator('footer').getByRole('link', { name: '来访留言', exact: true }).click()
    }
    await expect(page).toHaveURL(`${baseURL}/about#guestbook`)
    await page.getByRole('link', { name: '外观', exact: true }).click()
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/about#guestbook')
    const back = page.getByTestId('theme-page').getByRole('link', { name: '返回原页面', exact: true })
    await expect(back).toHaveAttribute('href', '/about#guestbook')
    await back.click()
    await expect(page).toHaveURL(`${baseURL}/about#guestbook`)
    await expect(page.locator('#guestbook')).toBeInViewport()
  }
})
