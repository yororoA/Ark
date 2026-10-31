import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const phone = { width: 390, height: 844 }
const designs = ['archive', 'rain', 'p3r', 'prism']
let browser

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, design, viewport = phone, { reducedMotion = 'no-preference', mascot = 'off', touch = true } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion })
  t.after(() => context.close())
  await context.addInitScript(({ design, mascot }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.mascot:v1', mascot)
  }, { design, mascot })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { page, context }
}

async function visit(page, path) {
  await page.goto(`${baseURL}${path}`)
  await page.locator('h1:visible').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  if (path !== '/login') await page.locator('[class*="account-links"]').waitFor({ state: 'attached' })
}

async function screenshot(page, name) {
  if (process.env.MOBILE_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${name}.png` })
  }
}

for (const design of designs) {
  for (const viewport of [phone, { width: 320, height: 568 }]) {
    test(`mobile feedback login centring and keyboard: ${design} ${viewport.width}`, async t => {
      const { page, context } = await session(t, design, viewport, { reducedMotion: 'reduce' })
      await context.route('**/api/session?all=true', route => route.fulfill({ json: { data: [], activeUid: null } }))
      await visit(page, '/login')
      const dialog = page.getByRole('dialog', { name: '账号管理', exact: true })
      await expect(dialog).toBeVisible()
      await expect.poll(() => dialog.evaluate(el => {
        const box = el.getBoundingClientRect()
        return Math.abs(box.top + box.height / 2 - innerHeight / 2)
      })).toBeLessThan(2)
      await screenshot(page, `${design}-${viewport.width}-login-centred`)
      await dialog.getByRole('button', { name: '注册', exact: true }).first().tap()
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, value: 300 })
        Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 25 })
        visualViewport.dispatchEvent(new Event('resize'))
        visualViewport.dispatchEvent(new Event('scroll'))
      })
      await expect.poll(() => dialog.evaluate(el => {
        const box = el.getBoundingClientRect()
        return box.top >= 25 && box.bottom <= 325
      })).toBe(true)
      for (const id of ['username', 'password', 'email', 'code']) {
        const input = dialog.locator(`#${id}`)
        await input.scrollIntoViewIfNeeded()
        const box = await input.boundingBox()
        assert(box.y >= 25 && box.y + box.height <= 325, `${id} remains above the keyboard`)
      }
      const submit = dialog.getByRole('button', { name: '注册', exact: true }).last()
      await submit.scrollIntoViewIfNeeded()
      const box = await submit.boundingBox()
      assert(box.y >= 25 && box.y + box.height <= 325, 'Registration action remains reachable')
    })
  }
}

for (const design of ['archive', 'rain']) {
  for (const viewport of [phone, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    test(`mobile feedback standalone full-screen menu: ${design} ${viewport.width}`, async t => {
      const { page } = await session(t, design, viewport)
      await visit(page, '/about')
      const opener = page.locator('[data-menu-toggle]')
      // Finish hydration and its initial scroll restoration before testing
      // menu ownership on a scrolled page.
      await opener.tap()
      await page.keyboard.press('Escape')
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }))
      const scrollBefore = await page.evaluate(() => scrollY)
      const openerBox = await opener.boundingBox()
      await page.touchscreen.tap(openerBox.x + openerBox.width / 2, openerBox.y + openerBox.height / 2)
      const dialog = page.locator('dialog[open]')
      await expect(dialog).toBeVisible()
      async function fullScreen() {
        const coverage = await dialog.evaluate(el => {
          const box = el.getBoundingClientRect()
          return {
            full: box.top === 0 && box.left === 0 && Math.abs(box.bottom - innerHeight) < 1 && Math.abs(box.right - innerWidth) < 1,
            background: getComputedStyle(el).backgroundColor,
            corners: [[1, 1], [innerWidth - 1, 1], [1, innerHeight - 1], [innerWidth - 1, innerHeight - 1]]
              .every(([x, y]) => document.elementFromPoint(x, y)?.closest('dialog') === el),
          }
        })
        assert(coverage.full && coverage.corners, 'Standalone menu owns the whole viewport')
        assert.notEqual(coverage.background, 'rgba(0, 0, 0, 0)', 'Opaque menu hides the original header and page')
      }
      await fullScreen()
      assert.equal(await opener.locator('svg.lucide-menu').count(), 1, 'Original trigger remains a menu icon below the full-screen surface')
      assert.equal(await dialog.getByRole('button', { name: '关闭', exact: true }).count(), 1)
      const close = dialog.getByRole('button', { name: '关闭', exact: true })
      const closeBox = await close.boundingBox()
      assert(closeBox.width >= 44 && closeBox.height >= 44, 'Menu owns a touch-accessible close button')
      const links = dialog.locator('nav a')
      await expect(links).toHaveCount(8)
      const body = dialog.locator('[class*="mobile-menu-body"]')
      for (const link of await links.all()) {
        await link.scrollIntoViewIfNeeded()
        const box = await link.boundingBox()
        const bodyBox = await body.boundingBox()
        assert(box.x >= 0 && box.x + box.width <= viewport.width + 1, 'Every menu label stays in view')
        assert(box.y >= bodyBox.y - 1 && box.y + box.height <= bodyBox.y + bodyBox.height + 1, 'Every destination is reachable inside the menu scroll area')
      }
      await expect(close).toBeInViewport()
      await expect(dialog.locator('[class*="mobile-menu-bottom"] a')).toBeInViewport()
      await links.first().focus()
      await page.keyboard.press('End')
      await expect(links.last()).toBeFocused()
      await expect(links.last()).toBeInViewport()
      await expect.poll(() => dialog.evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0)
      await screenshot(page, `${design}-${viewport.width}-standalone-menu`)
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'Opening and menu scrolling preserve the page position')
      await close.tap()
      await expect(dialog).toHaveCount(0)
      await expect(opener).toBeFocused()
      assert.equal(await page.evaluate(() => scrollY), scrollBefore)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      // Rotation keeps the standalone chrome visible while only the body scrolls.
      await opener.tap()
      await page.setViewportSize({ width: viewport.height, height: viewport.width })
      await fullScreen()
      await expect(close).toBeInViewport()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await opener.tap()
      assert.equal(await dialog.evaluate(el => el.getAnimations({ subtree: true }).length), 0, 'Reduced motion skips menu entrances')
      await dialog.locator('nav a[href="/moments"]').tap()
      await expect(page).toHaveURL(`${baseURL}/moments`)
      await expect(dialog).toHaveCount(0)
    })
  }
}

for (const viewport of [phone, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`mobile feedback P3R continuous entrance: ${viewport.width}`, async t => {
    const { page } = await session(t, 'p3r', viewport)
    await visit(page, '/about')
    // Complete a real interaction before scrolling. The route manager restores
    // the initial page position on hydration, independently of menu opening.
    const opener = page.locator('[data-menu-toggle]')
    await opener.tap()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }))
    const scrollBefore = await page.evaluate(() => scrollY)
    // Observe real rendered frames from the first open frame through 600ms.
    await page.evaluate(() => {
      window.menuFrames = []
      let start
      const observe = now => {
        const dialog = document.querySelector('dialog[open]')
        if (!dialog) { requestAnimationFrame(observe); return }
        start ??= now
        const surface = dialog.querySelector('[class*="menu-surface"]')
        const scroll = dialog.querySelector('[class*="menu-scroll"]')
        const box = dialog.getBoundingClientRect()
        window.menuFrames.push({
          elapsed: now - start, top: box.top, height: box.height, shellClip: getComputedStyle(dialog).clipPath,
          surfaceClip: surface ? getComputedStyle(surface).clipPath : null,
          scrollTop: scroll?.scrollTop,
          opacity: Array.from(dialog.querySelectorAll('nav a'), el => Number(getComputedStyle(el).opacity)),
        })
        if (now - start < 600) requestAnimationFrame(observe)
      }
      requestAnimationFrame(observe)
    })
    const box = await opener.boundingBox()
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    const dialog = page.locator('dialog[open]')
    await expect.poll(() => page.evaluate(() => window.menuFrames.at(-1)?.elapsed ?? 0)).toBeGreaterThanOrEqual(600)
    const frames = await page.evaluate(() => window.menuFrames)
    assert(frames.every(frame => Math.abs(frame.top) < 1 && Math.abs(frame.height - viewport.height) < 1), 'No partial-height native dialog during flood')
    assert(frames.every(frame => frame.shellClip === 'none' && frame.scrollTop === 0), 'Focus and clipping never shift the native shell or menu scroll')
    assert(new Set(frames.map(frame => frame.surfaceClip)).size > 3, 'Liquid outline advances across multiple frames')
    const settled = frames.filter(frame => frame.elapsed >= 440)
    assert(settled.every(frame => frame.surfaceClip === 'none' && frame.opacity.length === 8 && frame.opacity.every(value => value > .99)), 'All eight rows finish with the flood, including the lower half')
    assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'Opening preserves background scroll')
    await screenshot(page, `p3r-${viewport.width}-menu-motion`)
    const last = dialog.locator('nav a').last()
    await last.scrollIntoViewIfNeeded()
    const lastBox = await last.boundingBox()
    assert(lastBox.y >= 0 && lastBox.y + lastBox.height <= viewport.height + 1, 'Last entry remains reachable after flood')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    assert.equal(await page.evaluate(() => scrollY), scrollBefore)
  })
}

test('mobile feedback P3R interrupted entrance and reduced motion', async t => {
  const { page } = await session(t, 'p3r')
  await visit(page, '/moments')
  const opener = page.locator('[data-menu-toggle]')
  await opener.tap()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await opener.tap()
  await expect(dialog).toBeVisible()
  assert.equal(await dialog.evaluate(el => el.getAnimations({ subtree: true }).length), 0)
  await dialog.getByRole('button', { name: '关闭', exact: true }).tap()
  await expect(dialog).toHaveCount(0)
})

for (const design of designs) {
  test(`mobile feedback mascot size: ${design}`, async t => {
    const { page } = await session(t, design, phone, { mascot: 'on' })
    await visit(page, '/moments')
    await expect(page.getByRole('button', { name: '隐藏桌宠 / Hide mascot', exact: true })).toHaveAttribute('data-status', 'ready')
    const sprites = page.locator('[data-ark-mascot] img')
    await expect(sprites).toHaveCount(2)
    await expect.poll(() => sprites.evaluateAll(elements => elements.every(el => {
      const box = el.getBoundingClientRect()
      return box.width >= 63 && box.width <= 65 && box.height >= 63 && box.height <= 65
    }))).toBe(true)
    await screenshot(page, `${design}-mobile-mascots`)
    await page.setViewportSize({ width: 844, height: 390 })
    await expect.poll(() => sprites.first().evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(65)
    await page.setViewportSize({ width: 320, height: 568 })
    await expect.poll(() => sprites.first().evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(54)
  })
}

test('mobile feedback mascot resizes from desktop without changing preference', async t => {
  const { page } = await session(t, 'archive', { width: 1280, height: 900 }, { mascot: 'on', touch: false })
  await visit(page, '/moments')
  await expect(page.getByRole('button', { name: '隐藏桌宠 / Hide mascot', exact: true })).toHaveAttribute('data-status', 'ready')
  const sprite = page.locator('[data-ark-mascot] img').first()
  await expect.poll(() => sprite.evaluate(el => el.getBoundingClientRect().width)).toBe(128)
  await page.setViewportSize(phone)
  await expect.poll(() => sprite.evaluate(el => el.getBoundingClientRect().width)).toBe(64)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect.poll(() => sprite.evaluate(el => el.getBoundingClientRect().width)).toBe(128)
  assert.equal(await page.evaluate(() => localStorage.getItem('ark.mascot:v1')), 'on')
})
