import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:9999'
const account = { uid: 'voyage-transition-fixture', username: 'Voyage Reader', isGuest: false, isAdmin: false }
let browser

before(async () => {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, { reducedMotion = 'no-preference', respond } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion })
  t.after(() => context.close())
  await context.addInitScript(account => {
    localStorage.setItem('ark.design.v1', 'voyage')
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
    localStorage.setItem('authDetails', JSON.stringify([account]))
  }, account)
  // Synthetic credentials: these tests never call the authentication server.
  await context.route('**/api/session*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('all')
    ? { data: [account], activeUid: account.uid } : { data: account } }))
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
    window.voyageFrames = []
    window.voyageRecording = true
    const frame = () => {
      if (!window.voyageRecording) return
      const connection = document.querySelector('[data-testid="voyage-connection"]')
      const overlay = connection || document.querySelector('[data-testid="voyage-wipe"]')
      const phase = overlay?.dataset.phase
      const reveal = Number(connection?.dataset.reveal || 0)
      const alpha = []
      if (phase === 'covered' && !connection) {
        const canvas = overlay.querySelector('canvas'), context = canvas?.getContext('2d')
        if (context) for (const x of [.01, .5, .99]) for (const y of [.01, .5, .99]) {
          alpha.push(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data[3])
        }
      }
      window.voyageFrames.push({ phase, reveal, alpha, connection: !!connection,
        elapsed: Number(connection?.dataset.elapsed || 0), simple: connection?.dataset.simplified,
        background: connection && getComputedStyle(connection).backgroundColor,
        path: location.pathname, loading: !!document.querySelector('[data-route-loading],#main-content:empty') })
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}
async function stopFrames(page) {
  return page.evaluate(() => { window.voyageRecording = false; return window.voyageFrames })
}
async function assertInteractive(page) {
  assert.equal(await page.locator('main').evaluate(main => !!main.closest('[inert]')), false)
  await page.locator('[data-menu-toggle]').click()
  const menu = page.getByTestId('voyage-menu')
  await expect(menu).toBeVisible()
  await page.keyboard.press('End')
  await expect(menu.locator('nav a').last()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
}

test('Voyage route remains opaque until slow destination content is ready', async t => {
  const { context, page } = await session(t)
  const gate = await holdArticles(context, t)
  await page.goto(`${baseURL}/home`)
  await page.getByTestId('voyage-home').waitFor()
  await recordFrames(page)
  await page.locator('header nav a[href="/articles"]').first().click()
  const curtain = page.getByTestId('voyage-wipe')
  await expect(curtain).toHaveAttribute('data-phase', 'covered')
  await page.waitForTimeout(700)
  await expect(curtain).toHaveAttribute('data-phase', 'covered')
  assert(gate.requests > 0)
  gate.release()
  await page.waitForURL('**/articles')
  await expect(curtain).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('main h1')).toBeVisible()
  const frames = await stopFrames(page)
  const covered = frames.filter(frame => frame.alpha.length)
  assert(covered.length > 0)
  assert(covered.every(frame => frame.alpha.every(alpha => alpha === 255)), 'The route panels fully cover all edges')
  const opening = frames.filter(frame => frame.phase === 'opening')
  assert(opening.length > 0)
  assert(opening.every(frame => frame.path === '/articles' && !frame.loading), 'A loading fallback is never revealed')
  await assertInteractive(page)
})

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Voyage login completes the passage and waits for real content (${reducedMotion})`, async t => {
    const { context, page } = await session(t, { reducedMotion })
    const gate = await holdArticles(context, t)
    await page.goto(`${baseURL}/login?returnTo=%2Farticles`)
    await recordFrames(page)
    await page.getByRole('button', { name: '建立连接', exact: true }).click()
    const connection = page.getByTestId('voyage-connection')
    await expect(connection).toHaveAttribute('data-phase', 'covered', { timeout: 12000 })
    await page.waitForTimeout(700)
    await expect(connection).toHaveAttribute('data-phase', 'covered')
    assert.equal(new URL(page.url()).pathname, '/login')
    assert(gate.requests > 0)
    gate.release()
    await page.waitForURL('**/articles')
    await expect(connection).toHaveCount(0)
    await expect(page.locator('main h1')).toBeVisible()
    const frames = (await stopFrames(page)).filter(frame => frame.connection)
    assert(frames.length > 0)
    assert(frames.filter(frame => frame.phase === 'covered').every(frame => frame.background === 'rgb(8, 15, 67)'), 'Pending content stays behind an opaque route surface')
    if (reducedMotion === 'reduce') {
      assert(frames.every(frame => frame.simple === 'true'), 'Reduced motion is stationary from its first frame')
    } else {
      for (const phase of ['signal', 'course', 'closing', 'covered', 'revealing']) assert(frames.some(frame => frame.phase === phase), `The ${phase} stage is visible`)
      assert(frames.some(frame => frame.elapsed >= 3200), 'The full authored scene finishes')
      const revealing = frames.filter(frame => frame.reveal > 0)
      assert(revealing.length > 0)
      assert(revealing.every(frame => frame.path === '/articles' && !frame.loading), 'Login reveal waits for destination content, not merely a route commit')
    }
    await expect(page.getByTestId('voyage-wipe')).toHaveAttribute('data-phase', 'idle')
    await assertInteractive(page)
  })
}

test('Voyage skip shortens animation but does not skip destination readiness', async t => {
  const { context, page } = await session(t)
  const gate = await holdArticles(context, t)
  await page.goto(`${baseURL}/login?returnTo=%2Farticles`)
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const connection = page.getByTestId('voyage-connection')
  await expect(connection).toHaveAttribute('data-status', 'success')
  await connection.getByRole('button', { name: '跳过动画 ↗', exact: true }).click()
  await expect(connection).toHaveAttribute('data-phase', 'covered')
  await expect(connection).toHaveAttribute('data-simplified', 'true')
  await page.waitForTimeout(500)
  assert.equal(new URL(page.url()).pathname, '/login')
  await expect(connection).toBeVisible()
  gate.release()
  await page.waitForURL('**/articles')
  await expect(connection).toHaveCount(0)
  await expect(page.locator('main h1')).toBeVisible()
})

test('Voyage pending identity remains cancellable and ignores a late success', async t => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  const { page } = await session(t, { respond: async route => { await pending; await route.fulfill({ json: account }) } })
  await page.goto(`${baseURL}/login?returnTo=%2Farticles`)
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const connection = page.getByTestId('voyage-connection')
  await expect(connection).toHaveAttribute('data-phase', 'covered')
  await expect(connection).toHaveAttribute('data-status', 'pending')
  assert.equal(new URL(page.url()).pathname, '/login', 'A complete scene does not invent authentication success')
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    assert(await connection.evaluate(element => element.contains(document.activeElement)), 'Focus remains inside the connection')
  }
  await page.keyboard.press('Escape')
  await expect(connection).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
  release()
  await page.waitForTimeout(300)
  await expect(connection).toHaveCount(0)
  assert.equal(new URL(page.url()).pathname, '/login')
})

test('Voyage authentication errors remain readable and keyboard dismissible', async t => {
  const message = '隔离测试：连接暂不可用'
  const { page } = await session(t, { respond: route => route.fulfill({ status: 409, json: { message } }) })
  await page.goto(`${baseURL}/login`)
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const connection = page.getByTestId('voyage-connection')
  await expect(connection).toHaveAttribute('data-status', 'error')
  await expect(connection.getByRole('alert')).toHaveText(message)
  await page.keyboard.press('Tab')
  assert(await connection.evaluate(element => element.contains(document.activeElement)))
  await page.keyboard.press('Escape')
  await expect(connection).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
  assert.equal(new URL(page.url()).pathname, '/login')
})

test('Voyage reduced motion navigates without moving route panels', async t => {
  const { page } = await session(t, { reducedMotion: 'reduce' })
  await page.goto(`${baseURL}/home`)
  await page.getByTestId('voyage-home').waitFor()
  await recordFrames(page)
  await page.locator('header nav a[href="/articles"]').first().click()
  await page.waitForURL('**/articles')
  await expect(page.locator('main h1')).toBeVisible()
  assert((await stopFrames(page)).every(frame => !frame.phase || frame.phase === 'idle'))
  await assertInteractive(page)
})

for (const origin of [{ x: .16, y: .19 }, { x: .84, y: .81 }]) {
  test(`Voyage route begins at its requested coordinate (${origin.x}, ${origin.y})`, async t => {
    const { page } = await session(t)
    await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
    const frames = await page.evaluate(origin => new Promise(resolve => {
      const canvas = document.querySelector('[data-testid="voyage-wipe"] canvas')
      const layer = canvas.parentElement, context = canvas.getContext('2d')
      const samples = [], started = performance.now()
      const point = (x, y) => [...context.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height), 1, 1).data]
      const capture = () => {
        const elapsed = performance.now() - started
        if (layer.dataset.phase === 'closing' && elapsed < 145) samples.push({
          source: point(origin.x, origin.y), opposite: point(1 - origin.x, 1 - origin.y),
        })
        if (elapsed > 160) { resolve(samples); return }
        requestAnimationFrame(capture)
      }
      const event = new CustomEvent('ark:fold-transition', { cancelable: true, detail: {
        x: innerWidth * origin.x, y: innerHeight * origin.y, navigate: () => false,
      } })
      document.dispatchEvent(event)
      if (!event.defaultPrevented) { resolve([]); return }
      requestAnimationFrame(capture)
    }), origin)
    assert(frames.some(({ source, opposite }) => source[0] >= 200 && source[1] >= 230 && source[2] < 150 && source[3] > 200 && opposite[3] === 0),
      'The first route signal is at the activated coordinate, with the opposite side still clear')
    await expect(page.getByTestId('voyage-wipe')).toHaveAttribute('data-phase', 'idle')
  })
}

test('Voyage covered resize stays opaque and Escape releases the curtain', async t => {
  const { context, page } = await session(t)
  const gate = await holdArticles(context, t)
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  await page.locator('header nav a[href="/articles"]').first().click()
  const curtain = page.getByTestId('voyage-wipe')
  await expect(curtain).toHaveAttribute('data-phase', 'covered')
  // Observe the same resize event after the renderer's registered handler,
  // rather than waiting for a later animation frame to repair coverage.
  await page.evaluate(() => {
    window.voyageResizeAlpha = []
    addEventListener('resize', () => {
      const canvas = document.querySelector('[data-testid="voyage-wipe"] canvas')
      const context = canvas.getContext('2d')
      for (const x of [.01, .5, .99]) for (const y of [.01, .5, .99]) {
        window.voyageResizeAlpha.push(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data[3])
      }
    }, { once: true })
  })
  await page.setViewportSize({ width: 391, height: 845 })
  await expect.poll(() => page.evaluate(() => window.voyageResizeAlpha.length)).toBe(9)
  assert((await page.evaluate(() => window.voyageResizeAlpha)).every(alpha => alpha === 255), 'Resize itself never exposes the pending destination')
  await page.keyboard.press('Escape')
  await expect(curtain).toHaveAttribute('data-phase', 'idle')
  gate.release()
  await page.waitForURL('**/articles')
  await expect(page.locator('main h1')).toBeVisible()
})
