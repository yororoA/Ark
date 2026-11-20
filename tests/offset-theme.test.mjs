import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Start only the isolated in-memory preview:
// ARK_VERIFY_PORT=10600 node scripts/verify-blog.mjs --serve
// TEST_BASE_URL=http://127.0.0.1:10600 node --test tests/offset-theme.test.mjs
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10600'
const shots = process.env.OFFSET_SCREENSHOT_DIR || join(process.cwd(), 'docs/tests/offset')
const account = { uid: 'offset-visual-fixture', username: '错版访客', isGuest: true, isAdmin: false, lastLoginAt: '2026-11-13T00:00:00Z' }
const articleId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const momentId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
let browser

before(async () => {
  assert(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Use a local isolated preview, never a real backend')
  await mkdir(shots, { recursive: true })
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close() })

async function session(t, { width = 1440, mode = 'light', motion = 'reduce', design = 'offset', accounts = [], locale = 'zh', video = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 390 ? 844 : 1000 },
    hasTouch: width <= 640, reducedMotion: motion, colorScheme: mode,
    ...(video ? { recordVideo: { dir: shots, size: { width: 1280, height: 889 } } } : {}),
  })
  t.after(() => context.close())
  await context.addInitScript(({ mode, design, accounts, locale }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    for (const [key, value] of Object.entries({
      'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': locale,
      'ark.mascot:v1': 'off', authDetails: JSON.stringify(accounts),
    })) if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
  }, { mode, design, accounts, locale })
  await context.route('**/api/session**', route => route.fulfill({
    json: new URL(route.request().url()).searchParams.has('all')
      ? { data: accounts, activeUid: accounts[0]?.uid ?? null } : { data: accounts[0] ?? null },
  }))
  const authRequests = []
  await context.route('**/api/auth/**', route => {
    authRequests.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() })
    return route.fulfill({ json: { ...account, expiresAt: '2099-01-01T00:00:00Z' } })
  })
  // Reads come from the isolated fixture. Reading a detail may increment views;
  // intercept that counter too, so the browser never sends a content mutation.
  const writes = []
  await context.route('**/api/blog/**', route => {
    const request = route.request()
    if (['GET', 'HEAD'].includes(request.method())) return route.fallback()
    if (new URL(request.url()).pathname.endsWith('/knowledge/view')) return route.fulfill({ json: { data: { views: 13 } } })
    writes.push(`${request.method()} ${new URL(request.url()).pathname}`)
    return route.fulfill({ status: 409, json: { message: 'Offset visual tests never write content' } })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => {
    assert.deepEqual(errors, [], 'No uncaught browser errors')
    assert.deepEqual(writes, [], 'No content writes')
  })
  return { page, context, authRequests }
}

async function visit(page, path = '/home') {
  await page.goto(`${baseURL}${path}`)
  await expect(page.locator('html')).toHaveAttribute('data-design', 'offset')
  await page.evaluate(() => document.fonts.ready)
}
async function homeReady(page) {
  await visit(page)
  await expect(page.getByTestId('offset-home')).toBeVisible()
}
async function noOverflow(page) {
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  assert(metrics.document <= metrics.viewport + 1, `Page overflows: ${JSON.stringify(metrics)}`)
  const escaped = await page.locator('main h1:visible, [data-testid="offset-home"] nav a:visible').evaluateAll(elements => elements.flatMap(element => {
    const r = element.getBoundingClientRect()
    return r.left < -1 || r.right > innerWidth + 1 ? [{ text: element.textContent, left: r.left, right: r.right }] : []
  }))
  assert.deepEqual(escaped, [], 'Headings and navigation links stay within the viewport')
}
async function shot(page, name) {
  await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true })
}
async function choose(page, value) {
  const gallery = page.getByTestId('theme-page')
  await gallery.locator(`label:has(input[value="${value}"])`).click()
  await expect(gallery.locator(`input[value="${value}"]`)).toBeChecked()
}

async function traceWipe(page) {
  await page.evaluate(() => {
    const state = { frames: [], active: true, id: 0 }
    window.__offsetWipeTrace = state
    const sample = () => {
      if (!state.active) return
      const layer = document.querySelector('[data-testid="offset-wipe"]')
      const shutter = layer?.querySelector('[data-offset-shutter]')
      state.frames.push({
        phase: layer?.dataset.phase, pathname: location.pathname,
        ready: Boolean(document.querySelector('#main-content')?.children.length && !document.querySelector('[data-route-loading]')),
        x: [...(layer?.querySelectorAll('[data-offset-plate]') ?? [])].map(plate => new DOMMatrixReadOnly(getComputedStyle(plate).transform).e),
        aperture: shutter ? getComputedStyle(shutter).clipPath : null,
      })
      state.id = requestAnimationFrame(sample)
    }
    sample()
  })
  return async name => {
    const frames = await page.evaluate(() => {
      const state = window.__offsetWipeTrace
      state.active = false; cancelAnimationFrame(state.id)
      return state.frames
    })
    if (name) await writeFile(join(shots, `${name}.json`), JSON.stringify(frames))
    return frames
  }
}

function apertureArea(clipPath) {
  if (clipPath === 'none') return 0
  assert.match(clipPath ?? '', /^polygon\(evenodd,/, 'The reveal uses a real even-odd aperture')
  const coordinates = clipPath.match(/-?\d+(?:\.\d+)?%/g)?.map(value => Number.parseFloat(value)) ?? []
  assert.equal(coordinates.length, 20, 'The aperture contains an exterior boundary and an interior opening')
  const opening = Array.from({ length: 5 }, (_, index) => coordinates.slice(10 + index * 2, 12 + index * 2))
  const doubleArea = opening.reduce((area, [x, y], index) => {
    const [nextX, nextY] = opening[(index + 1) % opening.length]
    return area + x * nextY - nextX * y
  }, 0)
  return Math.abs(doubleArea) / 20000
}

async function holdRoute(context, pathname, t) {
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).pathname === pathname && route.request().headers().rsc === '1') await pending
    await route.fallback()
  })
  return release
}

async function wipeFinished(page, pathname) {
  await expect(page).toHaveURL(`${baseURL}${pathname}`, { timeout: 20000 })
  await expect(page.getByTestId('offset-wipe')).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('[data-route-loading]')).toHaveCount(0)
}

for (const width of [320, 390, 1440]) for (const mode of ['light', 'dark']) {
  test(`Offset home: ${width}px ${mode} has one visible heading and one activity block`, async t => {
    const { page } = await session(t, { width, mode })
    await homeReady(page)
    await expect(page.locator('main h1:visible')).toHaveCount(1)
    await expect(page.locator('main h1:visible')).toHaveAttribute('id', 'offset-title')
    await expect(page.getByTestId('home-activity')).toHaveCount(1)
    await expect(page.getByTestId('activity-calendar')).toBeVisible()
    await expect(page.getByTestId('activity-github')).toBeVisible()
    await expect(page.getByTestId('offset-home').getByRole('heading', { name: 'OFFSET / 错版', level: 1 })).toBeVisible()
    for (const href of ['/articles', '/moments', '/chat']) await expect(page.getByTestId('offset-home').locator(`nav a[href="${href}"]`)).toHaveCount(1)
    await noOverflow(page)
    assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), mode)
    await page.screenshot({ path: join(shots, `home-${width}-${mode}.png`), fullPage: false })
  })
}

for (const locale of ['en', 'ja', 'de']) test(`Offset locale: ${locale} fits a 320px home and menu`, async t => {
  const { page } = await session(t, { width: 320, locale })
  await homeReady(page)
  await expect(page.getByTestId('offset-home')).toHaveAttribute('lang', locale)
  await noOverflow(page)
  await page.locator('[data-menu-toggle]:visible').first().click()
  await expect(page.getByTestId('offset-menu')).toHaveAttribute('lang', locale)
  const dialogWidth = await page.getByTestId('offset-menu').evaluate(dialog => ({ width: dialog.clientWidth, scroll: dialog.scrollWidth }))
  assert(dialogWidth.scroll <= dialogWidth.width + 1, 'Localized menu does not scroll horizontally')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('offset-menu')).toHaveCount(0)
})

test('Offset storage: the legacy sky preference loads the new theme without a dead selection', async t => {
  const { page } = await session(t, { design: 'sky' })
  await homeReady(page)
  await expect(page.getByRole('heading', { name: 'OFFSET / 错版', level: 1 })).toBeVisible()
  await visit(page, '/theme')
  await expect(page.getByRole('radio', { name: '错版', exact: true })).toBeChecked()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'offset')
  await expect(page.getByRole('radio', { name: '错版', exact: true })).toBeChecked()
})

test('Offset journey: login and real routes use moving print plates and wait for content', async t => {
  const { page, context } = await session(t, { motion: 'no-preference', accounts: [account], video: true })
  const video = page.video()
  const release = await holdRoute(context, '/articles', t)
  await visit(page, '/login?returnTo=%2Fhome')
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  await expect(page.getByTestId('offset-connection')).toBeVisible()
  await expect(page).toHaveURL(`${baseURL}/home`, { timeout: 20000 })
  await expect(page.getByTestId('offset-connection')).toHaveCount(0)
  await expect(page.getByTestId('offset-home')).toBeVisible()
  await page.screenshot({ path: join(shots, 'offset-home-desktop.png'), fullPage: false })
  await page.waitForTimeout(600) // Leave each actual destination legible in the recorded walkthrough.
  const finish = await traceWipe(page)
  const wipe = page.getByTestId('offset-wipe')
  await page.getByTestId('offset-home').getByRole('link', { name: /进入文字/ }).click()
  await expect(wipe).toHaveAttribute('data-phase', 'covered')
  await expect(wipe.locator('[data-offset-destination]')).toHaveText('进入文字')
  await page.waitForTimeout(900)
  await expect(wipe).toHaveAttribute('data-phase', 'covered')
  assert.equal(new URL(page.url()).pathname, '/home', 'A slow real route response has not committed')
  const covered = await wipe.locator('[data-offset-plate]').evaluateAll(plates => plates.map(plate => new DOMMatrixReadOnly(getComputedStyle(plate).transform).e))
  assert(covered.length === 3 && covered.every(x => Math.abs(x) < 1), 'All three sheets cover the viewport while destination content is pending')
  await page.screenshot({ path: join(shots, 'offset-wipe-covered.png'), fullPage: false })
  release()
  await wipeFinished(page, '/articles')
  assert.equal(await page.locator('#main-content').evaluate(main => document.activeElement === main), true, 'The revealed destination receives keyboard focus')
  await page.waitForTimeout(600)
  await page.locator('a[href="/moments"]:visible').first().click()
  await wipeFinished(page, '/moments')
  const frames = await finish('motion-route-journey')
  const covering = frames.filter(frame => frame.phase === 'covering')
  const held = frames.filter(frame => frame.phase === 'covered')
  const revealing = frames.filter(frame => frame.phase === 'revealing')
  assert(covering.length > 5 && new Set(covering.map(frame => JSON.stringify(frame.x.map(Math.round)))).size > 5, 'Three plates actually move through intermediate cover frames')
  assert(covering.some(frame => new Set(frame.x.map(x => Math.round(Math.abs(x) / 20))).size === 3), 'The three plates are staggered rather than one static overlay')
  assert(held.length > 5 && held.every(frame => apertureArea(frame.aperture) === 0), 'The aperture remains closed throughout the wait for real destination content')
  assert(revealing.length > 5 && revealing.every(frame => frame.ready && ['/articles', '/moments'].includes(frame.pathname)), 'Reveal runs only over committed, ready destination content')
  assert(revealing.every(frame => frame.x.length === 3 && frame.x.every(x => Math.abs(x) < 1)), 'The three interlocking sheets stay in place while the aperture reveals the page')
  for (const pathname of ['/articles', '/moments']) {
    const routeFrames = revealing.filter(frame => frame.pathname === pathname)
    assert(new Set(routeFrames.map(frame => frame.aperture)).size > 5, `${pathname} is revealed through multiple computed aperture shapes`)
    const openingAreas = routeFrames.map(frame => apertureArea(frame.aperture))
    assert(Math.min(...openingAreas) < .03 && Math.max(...openingAreas) > 1, `${pathname} opens from a nearly closed aperture to an opening larger than the viewport`)
  }
  await noOverflow(page)
  await page.waitForTimeout(800)
  await context.close()
  await video.saveAs(join(shots, 'offset-journey.webm'))
})

test('Offset wipe: Escape skips a pending cover without abandoning its real navigation', async t => {
  const { page, context } = await session(t, { motion: 'no-preference' })
  const release = await holdRoute(context, '/articles', t)
  await homeReady(page)
  await page.getByTestId('offset-home').getByRole('link', { name: /进入文字/ }).click()
  await expect(page.getByTestId('offset-wipe')).toHaveAttribute('data-phase', 'covered')
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-offset-skip]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('offset-wipe')).toHaveAttribute('data-phase', 'idle')
  release()
  await wipeFinished(page, '/articles')
  assert.equal(await page.locator('html').getAttribute('data-offset-wipe'), null)
})

test('Offset wipe: reduced motion bypasses plates and hashes keep their native navigation', async t => {
  const { page } = await session(t)
  await homeReady(page)
  const finish = await traceWipe(page)
  await page.getByTestId('offset-home').getByRole('link', { name: /向下翻阅/ }).click()
  await expect(page).toHaveURL(`${baseURL}/home#offset-writings`)
  await page.getByTestId('offset-home').getByRole('link', { name: /进入文字/ }).click()
  await wipeFinished(page, '/articles')
  const frames = await finish('motion-reduced-routes')
  assert(frames.every(frame => frame.phase === 'idle'), 'Reduced motion uses native navigation without starting any full-page animation')
})

test('Offset wipe: browser back clears a pending transition and releases interaction', async t => {
  const { page, context } = await session(t, { motion: 'no-preference' })
  await visit(page, '/about')
  await homeReady(page)
  const release = await holdRoute(context, '/articles', t)
  await page.getByTestId('offset-home').getByRole('link', { name: /进入文字/ }).click()
  await expect(page.getByTestId('offset-wipe')).toHaveAttribute('data-phase', 'covered')
  await page.goBack()
  await expect(page).toHaveURL(`${baseURL}/about`)
  await expect(page.getByTestId('offset-wipe')).toHaveAttribute('data-phase', 'idle')
  release()
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(`${baseURL}/about`)
  assert.equal(await page.locator('html').getAttribute('data-offset-wipe'), null)
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
})

test('Offset selection persists across reload and returns to the source page', async t => {
  const { page } = await session(t, { design: 'archive', width: 390 })
  await page.goto(`${baseURL}/theme?returnTo=%2Fhome`)
  await expect(page.getByTestId('theme-page')).toBeVisible()
  await choose(page, 'offset')
  await choose(page, 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-design', 'offset')
  assert.deepEqual(await page.evaluate(() => ({ design: localStorage.getItem('ark.design.v1'), mode: localStorage.getItem('ark.theme') })), { design: 'offset', mode: 'dark' })
  await page.reload()
  await expect(page.getByRole('radio', { name: '错版', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: '深色', exact: true })).toBeChecked()
  await page.getByTestId('theme-page').getByRole('link', { name: '返回原页面', exact: true }).click()
  await expect(page).toHaveURL(`${baseURL}/home`)
  await expect(page.getByTestId('offset-home')).toBeVisible()
  await expect(page.locator('main h1:visible')).toHaveCount(1)
})

test('Offset home preserves real article and moment destinations', async t => {
  const { page } = await session(t)
  await homeReady(page)
  const home = page.getByTestId('offset-home')
  const article = home.locator(`a[href="/articles/${articleId}"]`)
  await expect(article).toHaveCount(1)
  await expect(article).toContainText('A small record of time')
  await expect(home.locator(`a[href="/moments/${momentId}"]`)).toHaveCount(1)
  await article.click()
  await expect(page).toHaveURL(`${baseURL}/articles/${articleId}`, { timeout: 20000 })
  await expect(page.locator('main h1')).toHaveText('A small record of time')
  await noOverflow(page)
})

test('Offset phone menu supports keyboard navigation, Escape, and focus restoration', async t => {
  const { page } = await session(t, { width: 320 })
  await homeReady(page)
  const more = page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('button', { name: '更多', exact: true })
  await more.focus()
  await page.keyboard.press('Enter')
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  const links = dialog.locator('nav a[href]')
  await links.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(links.nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(links.last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(links.first()).toBeFocused()
  await shot(page, 'mobile-menu-320')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(more).toBeFocused()
  await noOverflow(page)
})

test('Offset menu: staggered panels reverse from an interrupted opening frame', async t => {
  const { page } = await session(t, { width: 390, motion: 'no-preference' })
  await homeReady(page)
  const more = page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('button', { name: '更多', exact: true })
  await more.click()
  const dialog = page.getByTestId('offset-menu')
  await expect(dialog).toBeVisible()
  // Freeze the actual Web Animations at one shared elapsed time. This creates
  // an exact interrupted opening frame without racing a busy test machine.
  const opening = await dialog.evaluate(element => {
    for (const animation of element.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = 180
    }
    return [...element.querySelectorAll('[data-offset-panel]')].map(panel => new DOMMatrixReadOnly(getComputedStyle(panel).transform).e)
  })
  assert.equal(opening.length, 5)
  assert(opening.every(x => Math.abs(x) > 20), 'All five panels are visibly partway through their entry')
  assert(new Set(opening.map(x => Math.round(Math.abs(x) / 10))).size >= 3, 'Panels enter at staggered positions rather than as one static cover')
  await dialog.locator('[data-offset-control]').click()
  await expect(dialog).toHaveAttribute('data-phase', 'closing')
  const closing = await dialog.locator('[data-offset-panel]').evaluateAll(panels => panels.map(panel => new DOMMatrixReadOnly(getComputedStyle(panel).transform).e))
  assert(closing.every((x, index) => Math.abs(x - opening[index]) < 25), 'Closing starts from the interrupted geometry instead of snapping every panel fully open')
  await expect(dialog).toHaveCount(0)
  await expect(more).toBeFocused()
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
})

for (const motion of ['no-preference', 'reduce']) {
  test(`Offset login: pending auth never advances; success releases the page, ${motion}`, async t => {
    const { page, context } = await session(t, { width: 390, motion, accounts: [account] })
    let release
    const pending = new Promise(resolve => { release = resolve })
    t.after(() => release())
    await context.route('**/api/auth/**', async route => {
      await pending
      await route.fulfill({ json: { ...account, expiresAt: '2099-01-01T00:00:00Z' } })
    })
    const destination = '/articles?category=Development'
    await visit(page, `/login?returnTo=${encodeURIComponent(destination)}`)
    await expect(page.getByRole('button', { name: '建立连接', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '建立连接', exact: true }).click()
    const dialog = page.getByTestId('offset-connection')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-status', 'pending')
    await expect(dialog.getByRole('status')).toHaveText('正在确认身份…')
    await page.waitForTimeout(1100)
    await expect(page).toHaveURL(new RegExp('/login\\?returnTo='))
    await expect(dialog).toHaveAttribute('data-revealing', 'false')
    if (motion === 'reduce') await expect(dialog).toHaveAttribute('data-quick', 'true')
    assert.equal(await page.locator('main').evaluate(element => element.closest('[inert]') !== null), true)
    await noOverflow(page)
    await shot(page, `login-pending-${motion}`)
    if (motion === 'no-preference') await page.evaluate(() => {
      const frames = []
      window.__offsetLoginMotion = frames
      const sample = () => {
        const dialog = document.querySelector('[data-testid="offset-connection"]')
        if (!dialog) return
        const sheets = dialog.querySelector('[data-offset-login-sheets]')
        frames.push({
          phase: dialog.dataset.phase,
          status: dialog.dataset.status,
          revealing: dialog.dataset.revealing,
          pageReady: dialog.dataset.pageReady,
          pathname: location.pathname,
          contentReady: Boolean(document.querySelector('#main-content')?.children.length && !document.querySelector('[data-route-loading]')),
          cover: sheets ? { clip: getComputedStyle(sheets).clipPath, transform: getComputedStyle(sheets).transform, visibility: getComputedStyle(sheets).visibility } : null,
          slices: [...dialog.querySelectorAll('[data-offset-login-type-slice]')].map(slice => ({ transform: getComputedStyle(slice).transform, clip: getComputedStyle(slice).clipPath })),
          exit: [...dialog.querySelectorAll('[data-offset-login-exit-sheet]')].map(sheet => {
            const transform = getComputedStyle(sheet).transform
            const matrix = new DOMMatrixReadOnly(transform)
            return { side: sheet.dataset.side, transform, x: matrix.e, y: matrix.f, width: sheet.offsetWidth, height: sheet.offsetHeight }
          }),
        })
        requestAnimationFrame(sample)
      }
      sample()
    })
    release()
    await expect(page).toHaveURL(`${baseURL}${destination}`, { timeout: 20000 }).catch(async error => {
      t.diagnostic(JSON.stringify(await dialog.evaluate(element => ({ status: element.dataset.status, assembled: element.dataset.assembled, quick: element.dataset.quick, revealing: element.dataset.revealing, text: element.innerText })).catch(() => ({ dialog: 'missing' }))))
      throw error
    })
    await expect(dialog).toHaveCount(0)
    if (motion === 'no-preference') {
      const frames = await page.evaluate(() => window.__offsetLoginMotion)
      await writeFile(join(shots, 'motion-login-sequence.json'), JSON.stringify(frames))
      const assembly = frames.filter(frame => frame.status === 'success' && frame.revealing !== 'true')
      assert(assembly.length > 5 && assembly.every(frame => frame.slices.length === 5), 'Observe five type slices throughout successful registration')
      assert(new Set(assembly.map(frame => JSON.stringify(frame.slices))).size >= 5, 'Authentication success actually moves and registers the type slices over multiple frames')
      const covering = frames.filter(frame => frame.phase === 'impressing')
      assert(covering.length > 3 && covering.every(frame => frame.pathname === '/login' && frame.pageReady === 'false'), 'The login route stays in place while its opaque cover grows')
      assert(new Set(covering.map(frame => frame.cover?.clip)).size > 3, 'The login cover expands through multiple computed aperture shapes')
      const opening = frames.filter(frame => frame.revealing === 'true')
      assert(opening.length > 3 && opening.every(frame => frame.contentReady && frame.pathname === '/articles' && frame.pageReady === 'true'), 'The four aperture leaves reveal only committed destination content')
      assert(opening.every(frame => frame.exit.length === 4 && frame.exit.map(sheet => sheet.side).join(',') === 'top,right,bottom,left'), 'All four aperture edges remain present throughout the opening')
      assert(new Set(opening.map(frame => JSON.stringify(frame.exit))).size > 5, 'The four aperture leaves move through intermediate geometry')
      assert(opening.every(({ exit: [top, right, bottom, left] }) => top.y <= 1 && right.x >= -1 && bottom.y >= -1 && left.x <= 1
        && Math.abs(top.x) < 1 && Math.abs(bottom.x) < 1 && Math.abs(left.y) < 1 && Math.abs(right.y) < 1), 'Each aperture leaf moves outward along its own axis')
      const travel = sheet => sheet.side === 'top' || sheet.side === 'bottom' ? Math.abs(sheet.y) / sheet.height : Math.abs(sheet.x) / sheet.width
      assert(opening.some(frame => frame.exit.every(sheet => travel(sheet) < .05)) && opening.some(frame => frame.exit.every(sheet => travel(sheet) > .95)), 'The aperture opens from a fully covered centre to all four leaves clearing the viewport')
    }
    await expect(page.locator('main h1:visible')).toHaveCount(1)
    assert.equal(await page.locator('main').evaluate(element => element.closest('[inert]') !== null), false)
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    await noOverflow(page)
  })
}

test('Offset login: a paused cover cannot release navigation before its animation finishes', async t => {
  const { page, authRequests } = await session(t, { motion: 'no-preference', accounts: [account] })
  await visit(page, '/login?returnTo=%2Fabout')
  const pausedCover = await page.addStyleTag({ content: '[data-offset-login-sheets] { animation-play-state: paused !important; }' })
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const dialog = page.getByTestId('offset-connection')
  await expect(dialog).toHaveAttribute('data-status', 'success')
  await expect(dialog).toHaveAttribute('data-phase', 'impressing')
  const cover = dialog.locator('[data-offset-login-sheets]')
  const paused = await cover.evaluate(element => ({ name: getComputedStyle(element).animationName, state: getComputedStyle(element).animationPlayState, clip: getComputedStyle(element).clipPath }))
  assert.notEqual(paused.name, 'none', 'Pause the actual CSS cover animation')
  assert.equal(paused.state, 'paused')
  assert.notEqual(paused.clip, 'inset(0px)', 'The paused cover has not filled the screen')
  await page.waitForTimeout(750) // Longer than the authored cover, with its actual animation held still.
  await expect(page).toHaveURL(`${baseURL}/login?returnTo=%2Fabout`)
  await expect(dialog).toHaveAttribute('data-assembled', 'false')
  await expect(dialog).toHaveAttribute('data-revealing', 'false')
  await pausedCover.evaluate(element => element.remove())
  await expect(page).toHaveURL(`${baseURL}/about`, { timeout: 20000 })
  await expect(dialog).toHaveCount(0)
  assert.deepEqual(authRequests, [{ path: '/api/auth/switch', body: { uid: account.uid } }])
})

test('Offset login: a rejected connection shows its error and Escape restores the form', async t => {
  const { page, context } = await session(t, { width: 320, mode: 'dark', accounts: [account] })
  await context.route('**/api/auth/**', route => route.fulfill({ status: 503, json: { message: '测试连接暂时不可用' } }))
  await visit(page, '/login')
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const dialog = page.getByTestId('offset-connection')
  await expect(dialog).toHaveAttribute('data-status', 'error')
  await expect(dialog.getByRole('alert')).toHaveText('测试连接暂时不可用')
  await expect(dialog.getByRole('button', { name: '返回登录 ↗', exact: true })).toBeEnabled()
  await noOverflow(page)
  await shot(page, 'login-error-320-dark')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  const form = page.getByRole('dialog', { name: '账号管理', exact: true })
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: '其他账号登录', exact: true }).click()
  await form.locator('#username').fill('offset-retry')
  await expect(form.locator('#username')).toHaveValue('offset-retry')
  await noOverflow(page)
})

test('Offset login: cancel pending auth ignores its late response', async t => {
  const { page, context } = await session(t, { motion: 'no-preference', accounts: [account] })
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/api/auth/**', async route => {
    await pending
    await route.fulfill({ json: { ...account, expiresAt: '2099-01-01T00:00:00Z' } })
  })
  await visit(page, '/login?returnTo=%2Fabout')
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  const dialog = page.getByTestId('offset-connection')
  await expect(dialog).toHaveAttribute('data-status', 'pending')
  await dialog.getByRole('button', { name: '返回登录 ↗', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const response = page.waitForResponse(response => response.url().includes('/api/auth/'))
  release()
  await response
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
  await page.waitForTimeout(1200)
  await expect(page).toHaveURL(`${baseURL}/login?returnTo=%2Fabout`)
  await expect(dialog).toHaveCount(0)
})

test('Offset login: skip finishes success once without duplicate authentication', async t => {
  const { page, authRequests } = await session(t, { motion: 'no-preference', accounts: [account] })
  await visit(page, '/login?returnTo=%2Fabout')
  await page.getByRole('button', { name: '建立连接', exact: true }).dblclick({ delay: 0 })
  const dialog = page.getByTestId('offset-connection')
  await dialog.getByRole('button', { name: '跳过动画 ↗', exact: true }).click()
  await expect(page).toHaveURL(`${baseURL}/about`, { timeout: 20000 })
  await expect(dialog).toHaveCount(0)
  assert.deepEqual(authRequests, [{ path: '/api/auth/switch', body: { uid: account.uid } }])
  assert.equal(await page.locator('main').evaluate(element => element.closest('[inert]') !== null), false)
})
