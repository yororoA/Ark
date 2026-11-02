import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:9999'
const account = { uid: 'fold-transition-fixture', username: 'Fold Reader', isGuest: false, isAdmin: false }
let browser

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, { reducedMotion = 'no-preference', respond } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion })
  t.after(() => context.close())
  await context.addInitScript(account => {
    localStorage.setItem('ark.design.v1', 'fold')
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
    localStorage.setItem('authDetails', JSON.stringify([account]))
  }, account)
  // Synthetic identity only: no authentication request reaches a server.
  await context.route('**/api/session*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('all')
    ? { data: [account], activeUid: account.uid }
    : { data: account } }))
  await context.route('**/api/auth/**', respond || (route => route.fulfill({ json: account })))
  await context.route('**/api/blog/sse/subscribe', route => route.fulfill({ contentType: 'text/event-stream', body: 'retry: 600000\n: fixture\n\n' }))
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { context, page }
}

async function holdArticles(context, t) {
  let release, requests = 0
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/articles*', async route => {
    if (new URL(route.request().url()).pathname === '/articles' && route.request().headers().rsc === '1') {
      requests++
      await pending
    }
    await route.continue()
  })
  return { release, get requests() { return requests } }
}

async function recordFrames(page) {
  await page.evaluate(() => {
    window.foldFrames = []
    window.foldRecording = true
    const frame = () => {
      if (!window.foldRecording) return
      const connection = document.querySelector('[data-testid="fold-connection"]')
      const overlay = connection || document.querySelector('[data-testid="fold-wipe"]')
      const phase = overlay?.dataset.phase
      const reveal = Number(connection?.dataset.reveal || 0)
      const alpha = []
      // React's phase can trail the canvas by one frame. Only inspect the
      // fully covered frame, before either renderer starts uncovering it.
      if (phase === 'covered' && reveal === 0 && overlay.dataset.renderer !== 'static') {
        const canvas = overlay.querySelector('canvas')
        const context = canvas?.getContext('2d')
        if (context) for (const x of [.01, .5, .99]) for (const y of [.01, .5, .99]) {
          alpha.push(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data[3])
        }
      }
      window.foldFrames.push({ phase, reveal, alpha, connection: !!connection, renderer: connection?.dataset.renderer,
        path: location.pathname, loading: !!document.querySelector('[data-route-loading], #main-content:empty') })
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

async function stopFrames(page) {
  return page.evaluate(() => { window.foldRecording = false; return window.foldFrames })
}

function assertOpaqueCoverage(frames) {
  const covered = frames.filter(frame => frame.alpha.length)
  assert(covered.length > 0, 'The curtain has fully covered frames')
  assert(covered.every(frame => frame.alpha.every(alpha => alpha === 255)), 'Covered frames are opaque at the center and viewport edges')
}

async function assertInteractive(page) {
  assert.equal(await page.locator('main').evaluate(main => !!main.closest('[inert]')), false)
  await page.locator('[data-menu-toggle]').click()
  await expect(page.getByTestId('fold-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('fold-menu')).toHaveCount(0)
}

test('Fold page curtain waits for a slow route and releases pointer interaction', async t => {
  const { context, page } = await session(t)
  const gate = await holdArticles(context, t)
  await page.goto(`${baseURL}/home`)
  await page.getByTestId('fold-home').waitFor()
  await recordFrames(page)
  await page.locator('header nav a[href="/articles"]').first().click()
  const curtain = page.getByTestId('fold-wipe')
  await expect(curtain).toHaveAttribute('data-phase', 'covered')
  await page.waitForTimeout(900)
  await expect(curtain).toHaveAttribute('data-phase', 'covered')
  assert(gate.requests > 0, 'The destination request is being held')
  gate.release()
  await page.waitForURL('**/articles')
  await expect(curtain).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('main h1')).toBeVisible()
  const frames = await stopFrames(page)
  assertOpaqueCoverage(frames)
  assert(frames.some(frame => frame.phase === 'closing'))
  const opening = frames.filter(frame => frame.phase === 'opening')
  assert(opening.length > 0)
  assert(opening.every(frame => frame.path === '/articles' && !frame.loading), 'Page reveal never exposes a loading fallback')
  await assertInteractive(page)
})

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Fold login stays covered across a slow route (${reducedMotion})`, async t => {
    const { context, page } = await session(t, { reducedMotion })
    const gate = await holdArticles(context, t)
    await page.goto(`${baseURL}/login?returnTo=%2Farticles`)
    await page.getByRole('button', { name: '建立连接', exact: true }).waitFor()
    await recordFrames(page)
    await page.getByRole('button', { name: '建立连接', exact: true }).click()
    const connection = page.getByTestId('fold-connection')
    await expect(connection).toHaveAttribute('data-phase', 'covered', { timeout: 12000 })
    await page.waitForTimeout(900)
    await expect(connection).toHaveAttribute('data-phase', 'covered')
    assert.equal(new URL(page.url()).pathname, '/login')
    assert(gate.requests > 0, 'Navigation was requested under the curtain')
    gate.release()
    await page.waitForURL('**/articles')
    await expect(connection).toHaveCount(0)
    await expect(page.locator('main h1')).toBeVisible()
    const frames = (await stopFrames(page)).filter(frame => frame.connection)
    assert(frames.length > 0)
    if (reducedMotion === 'reduce') {
      assert(frames.every(frame => ['static', 'pending'].includes(frame.renderer)), 'Reduced motion uses a stationary curtain')
    } else {
      assertOpaqueCoverage(frames)
      for (const phase of ['crease', 'opening', 'passage', 'closing', 'covered', 'revealing']) {
        assert(frames.some(frame => frame.phase === phase), `Login includes the ${phase} scene`)
      }
      // Pathname alone is insufficient: Next can commit a route while its
      // Suspense fallback is still visible. This caught the premature reveal.
      const revealing = frames.filter(frame => frame.reveal > 0)
      assert(revealing.length > 0)
      assert(revealing.every(frame => frame.path === '/articles' && !frame.loading), 'Login reveal waits for actual destination content')
    }
    await expect(page.getByTestId('fold-wipe')).toHaveAttribute('data-phase', 'idle')
    await assertInteractive(page)
  })
}

test('Fold reduced motion navigates without a moving page curtain', async t => {
  const { page } = await session(t, { reducedMotion: 'reduce' })
  await page.goto(`${baseURL}/home`)
  await page.getByTestId('fold-home').waitFor()
  await recordFrames(page)
  await page.locator('header nav a[href="/articles"]').first().click()
  await page.waitForURL('**/articles')
  await expect(page.locator('main h1')).toBeVisible()
  const frames = await stopFrames(page)
  assert(frames.every(frame => !frame.phase || frame.phase === 'idle'))
  await assertInteractive(page)
})

test('Fold pending authentication can be cancelled and a late response stays dismissed', async t => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  const { page } = await session(t, { respond: async route => { await pending; await route.fulfill({ json: account }) } })
  await page.goto(`${baseURL}/login?returnTo=%2Farticles`)
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const connection = page.getByTestId('fold-connection')
  await expect(connection).toHaveAttribute('data-phase', 'covered', { timeout: 12000 })
  await expect(connection).toHaveAttribute('data-status', 'pending')
  assert.equal(new URL(page.url()).pathname, '/login', 'Completing the animation does not invent authentication success')
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    assert(await connection.evaluate(element => element.contains(document.activeElement)), 'Keyboard focus remains in the overlay')
  }
  await page.keyboard.press('Escape')
  await expect(connection).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
  release()
  await page.waitForTimeout(300)
  await expect(connection).toHaveCount(0)
  assert.equal(new URL(page.url()).pathname, '/login', 'A late success cannot navigate an abandoned connection')
})

test('Fold authentication error remains readable and Escape returns to login', async t => {
  const message = '隔离测试：连接暂不可用'
  const { page } = await session(t, { respond: route => route.fulfill({ status: 409, json: { message } }) })
  await page.goto(`${baseURL}/login`)
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const connection = page.getByTestId('fold-connection')
  await expect(connection).toHaveAttribute('data-status', 'error')
  await expect(connection.getByRole('alert')).toHaveText(message)
  await page.keyboard.press('Tab')
  assert(await connection.evaluate(element => element.contains(document.activeElement)))
  await page.keyboard.press('Escape')
  await expect(connection).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
  assert.equal(new URL(page.url()).pathname, '/login')
})
