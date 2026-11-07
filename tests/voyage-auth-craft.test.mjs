import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:9999'
const account = { uid: 'voyage-auth-craft', username: 'Voyage Reader', isGuest: false, isAdmin: false }
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function session(t, { width = 1440, height = 900, locale = 'zh', username = account.username, reducedMotion = 'no-preference', respond } = {}) {
  const identity = { ...account, username }
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion })
  t.after(() => context.close())
  await context.addInitScript(({ identity, locale }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': 'voyage', 'ark.theme': 'light', 'ark.locale': locale, 'ark.mascot:v1': 'off', authDetails: JSON.stringify([identity]) })) localStorage.setItem(key, value)
    window.connectionRafRequests = 0
    const raf = window.requestAnimationFrame
    window.requestAnimationFrame = callback => {
      if (new Error().stack?.includes('voyage-connection.tsx')) window.connectionRafRequests++
      return raf(callback)
    }
  }, { identity, locale })
  await context.route('**/api/session*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('all') ? { data: [identity], activeUid: identity.uid } : { data: identity } }))
  await context.route('**/api/auth/**', respond || (route => route.fulfill({ json: identity })))
  await context.route('**/api/blog/sse/subscribe', route => route.fulfill({ contentType: 'text/event-stream', body: 'retry: 600000\n: fixture\n\n' }))
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.goto(`${baseURL}/login?returnTo=%2Farticles`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return { context, page, connection: page.getByTestId('voyage-connection') }
}

function gate(t) {
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  return { release, pending }
}
async function begin(page) { await page.getByRole('button', { name: '建立连接', exact: true }).click() }
async function settledRafCount(page) {
  // Allow the final phase render and resize observer to settle first.
  await page.waitForTimeout(100)
  const before = await page.evaluate(() => window.connectionRafRequests)
  await page.waitForTimeout(220)
  return { before, after: await page.evaluate(() => window.connectionRafRequests) }
}

test('Voyage light follows the path, sleeps at identity and reaches arrival only after content is ready', async t => {
  const auth = gate(t), content = gate(t)
  const { context, page, connection } = await session(t, { respond: async route => { await auth.pending; await route.fulfill({ json: account }) } })
  await context.route('**/articles*', async route => {
    if (new URL(route.request().url()).pathname === '/articles' && route.request().headers().rsc === '1') await content.pending
    await route.continue()
  })
  await page.evaluate(() => {
    window.connectionSamples = []
    const capture = () => {
      const dialog = document.querySelector('[data-testid="voyage-connection"]')
      if (dialog) {
        const path = dialog.querySelector('[data-voyage-route]'), light = dialog.querySelector('[data-voyage-beacon]').getBoundingClientRect()
        const course = Number(dialog.style.getPropertyValue('--course')), point = path.getPointAtLength(path.getTotalLength() * course), matrix = path.getScreenCTM()
        window.connectionSamples.push({ course, station: dialog.dataset.station, status: dialog.dataset.status,
          path: location.pathname, loading: !!document.querySelector('[data-route-loading]'),
          error: Math.hypot(light.x + light.width / 2 - (matrix.a * point.x + matrix.c * point.y + matrix.e), light.y + light.height / 2 - (matrix.b * point.x + matrix.d * point.y + matrix.f)),
          round: Math.abs(light.width - light.height),
        })
      }
      if (window.recordConnection !== false) requestAnimationFrame(capture)
    }
    requestAnimationFrame(capture)
  })
  await begin(page)
  await expect(connection).toHaveAttribute('data-waiting', 'identity')
  await expect(connection).toHaveAttribute('data-station', '1')
  await expect(connection).toHaveAttribute('data-status', 'pending')
  const checkpoint = await connection.evaluate(dialog => {
    const light = dialog.querySelector('[data-voyage-beacon]').getBoundingClientRect(), station = dialog.querySelector('[data-voyage-station="1"]').getBoundingClientRect()
    return Math.hypot(light.x + light.width / 2 - station.x - station.width / 2, light.y + light.height / 2 - station.y - station.height / 2)
  })
  assert(checkpoint < 1, 'The waiting light is on the physical identity station')
  let frames = await settledRafCount(page)
  assert(frames.before > 0, 'The component RAF instrumentation observes motion')
  assert.equal(frames.after, frames.before, 'Identity waits do not keep a RAF loop alive')
  const resumedAt = Date.now()
  auth.release()
  await expect(connection).toHaveAttribute('data-waiting', 'content')
  assert(Date.now() - resumedAt < 2200, 'A delayed response resumes the remainder without replaying a full intro')
  await expect(connection).toHaveAttribute('data-station', '2')
  assert.equal(new URL(page.url()).pathname, '/login')
  frames = await settledRafCount(page)
  assert.equal(frames.after, frames.before, 'Content waits do not keep a RAF loop alive')
  content.release()
  await expect(connection).toHaveCount(0)
  const samples = await page.evaluate(() => { window.recordConnection = false; return window.connectionSamples })
  assert(samples.filter(sample => sample.course > 0).every(sample => sample.error < 1 && sample.round < .1), 'The CSS-sized light stays circular and follows the SVG path')
  const arrivals = samples.filter(sample => sample.station === '3')
  assert(arrivals.length > 0)
  assert(arrivals.every(sample => sample.status === 'success' && sample.path === '/articles' && !sample.loading))
  for (let index = 1; index < samples.length; index++) assert(samples[index].course >= samples[index - 1].course, 'Progress never jumps backward on authentication or readiness changes')
})

test('Voyage identity remains readable and separate from controls in four languages and screen shapes', async t => {
  const longName = 'AlexandriaTheReader_WhoKeepsEveryQuietMemory_夜航阅读者'
  for (const [width, height, locale, label] of [[1440, 900, 'zh', '正在确认身份'], [390, 844, 'en', 'Checking your identity'], [320, 568, 'ja', '本人確認中'], [844, 390, 'de', 'Identität wird geprüft']]) {
    const auth = gate(t)
    const { context, page, connection } = await session(t, { width, height, locale, username: longName, respond: async route => { await auth.pending; await route.fulfill({ json: account }) } })
    await begin(page)
    await expect(connection).toHaveAttribute('data-waiting', 'identity')
    await expect(connection).toHaveAttribute('lang', locale)
    await expect(connection.locator('h1')).toHaveText(label)
    const geometry = await connection.evaluate(dialog => {
      const identity = dialog.querySelector('[data-voyage-identity]'), headline = dialog.querySelector('[data-voyage-headline]'), progress = dialog.querySelector('[data-voyage-progress]'), footer = dialog.querySelector('footer')
      const rect = element => element.getBoundingClientRect(), overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      const i = rect(identity)
      return { overlaps: [headline, progress, footer].map(element => overlap(i, rect(element))), bottom: rect(footer).bottom, height: innerHeight, scroll: identity.scrollHeight > identity.clientHeight, clip: dialog.scrollHeight > dialog.clientHeight, text: identity.querySelector('p').textContent }
    })
    assert(geometry.overlaps.every(value => value < 1), `${width}×${height}: identity does not cover the headline, progress or actions`)
    assert(geometry.bottom <= height && !geometry.clip)
    assert(geometry.text.endsWith(longName), 'The username is preserved in full')
    if (geometry.scroll) {
      const identity = connection.locator('[data-voyage-identity]')
      await identity.focus(); await page.keyboard.press('End')
      await expect.poll(() => identity.evaluate(element => element.scrollTop >= element.scrollHeight - element.clientHeight - 1)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(connection).toHaveCount(0)
    await context.close()
  }
})

test('Voyage responds to reduced motion during an identity wait and preserves destination readiness', async t => {
  const auth = gate(t), content = gate(t)
  const { context, page, connection } = await session(t, { respond: async route => { await auth.pending; await route.fulfill({ json: account }) } })
  await context.route('**/articles*', async route => { if (route.request().headers().rsc === '1') await content.pending; await route.continue() })
  await begin(page)
  await expect(connection).toHaveAttribute('data-waiting', 'identity')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(connection).toHaveAttribute('data-simplified', 'true')
  await expect(connection).toHaveAttribute('data-station', '1')
  auth.release()
  await expect(connection).toHaveAttribute('data-waiting', 'content')
  await expect(connection).toHaveAttribute('data-station', '2')
  assert.equal(new URL(page.url()).pathname, '/login')
  content.release()
  await expect(connection).toHaveCount(0)
  await expect(page.locator('main h1')).toBeVisible()
})

test('Voyage form submission releases input focus and fits a keyboard-height proxy viewport', async t => {
  const auth = gate(t)
  const { page, connection } = await session(t, { width: 390, height: 844, respond: async route => { await auth.pending; await route.fulfill({ json: account }) } })
  await page.getByRole('button', { name: '管理账号', exact: true }).click()
  await page.getByRole('button', { name: '其他账号登录', exact: true }).click()
  await page.locator('#username').fill(account.username)
  await page.locator('#password').fill('synthetic-fixture-password')
  await page.locator('#password').focus()
  await page.setViewportSize({ width: 390, height: 410 })
  await page.getByRole('dialog', { name: '账号管理', exact: true }).getByRole('button', { name: '登录', exact: true }).last().click()
  await expect(connection).toHaveAttribute('data-waiting', 'identity')
  const geometry = await connection.evaluate(dialog => ({
    focused: document.activeElement === dialog,
    identityBottom: dialog.querySelector('[data-voyage-identity]').getBoundingClientRect().bottom,
    footerTop: dialog.querySelector('footer').getBoundingClientRect().top,
    overflow: dialog.scrollHeight > dialog.clientHeight,
  }))
  assert(geometry.focused, 'The dialog takes focus from the unmounted password field')
  assert(geometry.identityBottom < geometry.footerTop && !geometry.overflow)
  await page.keyboard.press('Escape')
  await expect(connection).toHaveCount(0)
})

test('Voyage hidden-page simplification stays cancellable and leaves no animation work behind', async t => {
  const auth = gate(t)
  const { page, connection } = await session(t, { respond: async route => { await auth.pending; await route.fulfill({ json: account }) } })
  await begin(page)
  await expect(connection).toHaveAttribute('data-phase', 'course')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(connection).toHaveAttribute('data-simplified', 'true')
  await expect(connection).toHaveAttribute('data-waiting', 'identity')
  await page.evaluate(() => {
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.keyboard.press('Escape')
  await expect(connection).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
  const frames = await settledRafCount(page)
  assert.equal(frames.after, frames.before)
  auth.release()
  await page.waitForTimeout(250)
  assert.equal(new URL(page.url()).pathname, '/login')
  await expect(connection).toHaveCount(0)
})
