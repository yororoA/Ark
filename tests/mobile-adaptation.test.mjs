import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const designs = ['archive', 'rain', 'p3r', 'prism']
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
let browser

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, design, viewport, { locale = 'zh', theme = 'light', reducedMotion = 'reduce' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion })
  t.after(() => context.close())
  await context.addInitScript(({ design, locale, theme }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.theme', theme)
    localStorage.setItem('ark.locale', locale)
  }, { design, locale, theme })
  const response = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { username: `mobile-${design}-${viewport.width}-${Date.now()}`, password: 'fixture-password' },
  })
  assert.equal(response.status(), 200, 'Run against the isolated verify:blog:preview fixture')
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { context, page }
}

async function visit(page, route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'load' })
  if (route === '/chat') await page.getByRole('log').waitFor()
  else await page.locator('h1:visible').first().waitFor()
  if (route !== '/login' && route !== '/chat') await page.locator('[class*="account-links"]').waitFor({ state: 'attached' })
}

for (const design of designs) {
  for (const viewport of [viewports[0], viewports[2]]) {
    test(`mobile media and editors: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport, { locale: 'en' })
      await visit(page, '/articles/new')
      const content = page.getByLabel('Content / Markdown')
      const text = 'First line\nSecond line\n\n| Wide column | Wide column | Wide column |\n| --- | --- | --- |\n| LongValueLongValueLongValue | LongValueLongValueLongValue | LongValueLongValueLongValue |\n\n```\n' + 'code'.repeat(100) + '\n```'
      await content.fill(text)
      assert.equal(await content.evaluate(el => getComputedStyle(el).fontSize), '16px', 'Editor does not trigger phone input zoom')
      await page.getByRole('button', { name: 'Preview', exact: true }).tap()
      await expect(page.locator('[class*="markdown"] p').first()).toHaveText('First line\nSecond line')
      const table = page.locator('[class*="markdown"] table')
      const code = page.locator('[class*="markdown"] pre')
      for (const element of [table, code]) {
        const box = await element.boundingBox()
        assert(box.x >= 0 && box.x + box.width <= viewport.width + 1, 'Wide Markdown stays in its own scroll area')
      }
      assert(await code.evaluate(el => el.scrollWidth > el.clientWidth), 'Wide code can scroll horizontally')
      const image = await readFile(new URL('../public/login_light.png', import.meta.url))
      await page.locator('input[type="file"]').setInputFiles({ name: '手机图片.png', mimeType: 'image/png', buffer: image })
      const opener = page.getByRole('button', { name: '手机图片.png', exact: true })
      await opener.tap()
      const dialog = page.locator('dialog[open]')
      await fitsViewport(dialog, viewport, 'Image preview')
      const media = dialog.locator('[class*="preview-media"]')
      const img = media.locator('img')
      await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true)
      const imageBox = await img.boundingBox()
      const mediaBox = await media.boundingBox()
      assert(imageBox.x >= mediaBox.x - 1 && imageBox.x + imageBox.width <= mediaBox.x + mediaBox.width + 1, 'Entire image fits before zoom')
      assert(mediaBox.height > 70, 'Media remains visible on short screens')
      // Exercise real multi-touch input, then drag the magnified image.
      const cdp = await page.context().newCDPSession(page)
      const y = mediaBox.y + mediaBox.height / 2
      const x = mediaBox.x + mediaBox.width / 2
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x - 25, y }, { id: 2, x: x + 25, y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x - 50, y }, { id: 2, x: x + 50, y }] })
      await expect(dialog.locator('output')).toHaveText('200%')
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x - 50, y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x - 30, y: y + 15 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect.poll(() => media.locator('[class*="preview-canvas"]').evaluate(el => getComputedStyle(el).transform)).not.toBe('matrix(1, 0, 0, 1, 0, 0)')
      await dialog.getByRole('button', { name: 'Reset zoom' }).tap()
      await expect(dialog.locator('output')).toHaveText('100%')
      assert.equal(await media.locator('[class*="preview-canvas"]').evaluate(el => getComputedStyle(el).transform), 'matrix(1, 0, 0, 1, 0, 0)')
      await dialog.getByRole('button', { name: 'Close', exact: true }).tap()
      await expect(opener).toBeFocused()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
    })
  }
}

for (const design of designs) {
  test(`mobile first login: ${design}`, async t => {
    const viewport = { width: 320, height: 400 }
    const { page, context } = await session(t, design, viewport)
    await context.route('**/api/session?all=true', route => route.fulfill({ json: { data: [], activeUid: null } }))
    await visit(page, '/login')
    const dialog = page.getByRole('dialog', { name: '账号管理', exact: true })
    await expect(dialog).toBeVisible()
    await fitsViewport(dialog, viewport, 'First login')
    await dialog.getByRole('button', { name: '注册', exact: true }).first().tap()
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 320 })
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 20 })
      visualViewport.dispatchEvent(new Event('resize'))
      visualViewport.dispatchEvent(new Event('scroll'))
    })
    await expect.poll(() => dialog.evaluate(el => el.parentElement.getBoundingClientRect().height)).toBe(320)
    await fitsViewport(dialog, { width: viewport.width, height: 340 }, 'Registration above the keyboard')
    for (const id of ['username', 'password', 'email', 'code']) {
      const field = dialog.locator(`#${id}`)
      await field.scrollIntoViewIfNeeded()
      await fitsViewport(field, { width: viewport.width, height: 340 }, id)
      assert.equal(await field.evaluate(el => getComputedStyle(el).fontSize), '16px')
    }
    const action = dialog.getByRole('button', { name: '注册', exact: true }).last()
    await action.scrollIntoViewIfNeeded()
    await fitsViewport(action, { width: viewport.width, height: 340 }, 'Registration')
  })
  for (const locale of ['ja', 'de']) {
    test(`mobile localized dark pages: ${design} ${locale}`, async t => {
      const viewport = { width: 320, height: 568 }
      const { page } = await session(t, design, viewport, { locale, theme: 'dark' })
      for (const route of ['/home', '/articles', '/moments', '/gallery', '/archive', '/about', '/lab', '/unrecognized-mobile-route']) {
        await visit(page, route)
        const failures = await page.locator('main h1, main h2, main p, main button, main a').evaluateAll(nodes => nodes.flatMap(el => {
          // Orbital artwork intentionally moves inside its clipped art window.
          if (el.closest('[class*="hero-art"]')) return []
          const box = el.getBoundingClientRect()
          return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1) ? [{ text: el.textContent?.slice(0, 50), left: box.left, right: box.right }] : []
        }))
        assert.deepEqual(failures, [], route)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width, route)
      }
    })
  }
}

for (const design of designs) {
  for (const viewport of [viewports[0], viewports[2]]) {
    test(`mobile filters: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport)
      await visit(page, '/articles')
      const opener = page.getByRole('button', { name: '日期: 不限日期', exact: true })
      await opener.tap()
      const calendar = page.locator('[class*="calendar-popup"]')
      await expect(calendar).toBeVisible()
      await fitsViewport(calendar, viewport, 'Calendar popup')
      const reset = calendar.getByRole('button', { name: '清除筛选', exact: true })
      await reset.scrollIntoViewIfNeeded()
      await fitsViewport(reset, viewport, 'Calendar reset')
      await reset.tap()
      await expect(calendar).toHaveCount(0)
      await page.getByRole('combobox', { name: '语言', exact: true }).tap()
      const list = page.getByRole('listbox')
      await fitsViewport(list, viewport, 'Language options')
      await page.getByRole('option', { name: /English/ }).tap()
      await expect(page.locator('[class*="localized-title"]')).toHaveText('Writings')
    })
  }
}

for (const design of designs) {
  for (const viewport of [viewports[0], viewports[1], viewports[2]]) {
    test(`mobile login panels: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page, context } = await session(t, design, viewport)
      const saved = Array.from({ length: 5 }, (_, i) => ({ uid: `saved-${i}`, username: `很长的测试账号名称 ${i}`, isAdmin: false, isGuest: false }))
      await context.route('**/api/session?all=true', route => route.fulfill({ json: { data: saved, activeUid: saved[0].uid } }))
      await visit(page, '/login')
      const opener = page.getByRole('button', { name: '管理账号', exact: true })
      await opener.tap()
      const dialog = page.getByRole('dialog', { name: '账号管理', exact: true })
      await fitsViewport(dialog, viewport, 'Account dialog')
      const list = dialog.getByRole('list', { name: '已保存账号' })
      await expect(list.getByRole('listitem')).toHaveCount(5)
      const last = list.getByRole('listitem').last().getByRole('button').first()
      await last.scrollIntoViewIfNeeded()
      await fitsViewport(last, viewport, 'Last saved account')
      await last.tap()
      await list.getByRole('listitem').last().getByRole('button').last().tap()
      const confirmation = page.getByRole('alertdialog')
      await fitsViewport(confirmation, viewport, 'Delete confirmation')
      await confirmation.getByRole('button', { name: '取消', exact: true }).tap()
      await expect(confirmation).toHaveCount(0)
      await dialog.getByRole('button', { name: '其他账号登录' }).tap()
      await dialog.getByRole('button', { name: '注册', exact: true }).first().tap()
      const code = dialog.locator('#code')
      await code.scrollIntoViewIfNeeded()
      await fitsViewport(code, viewport, 'Verification field')
      await code.fill('123456')
      const submit = dialog.getByRole('button', { name: '注册', exact: true }).last()
      await submit.scrollIntoViewIfNeeded()
      await fitsViewport(submit, viewport, 'Registration action')
      const overflow = await dialog.locator('button, input, h1, a').evaluateAll(nodes => nodes.flatMap(el => {
        const box = el.getBoundingClientRect()
        return box.width && (box.left < -1 || box.right > innerWidth + 1) ? [el.textContent || el.id] : []
      }))
      assert.deepEqual(overflow, [], 'All dialog controls fit')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(opener).toBeFocused()
      await page.getByRole('button', { name: '版权与设计声明' }).tap()
      const declaration = page.getByRole('dialog', { name: '免责声明' })
      await fitsViewport(declaration, viewport, 'Declaration')
      await declaration.getByRole('button', { name: '我知道了' }).tap()
      await expect(declaration).toHaveCount(0)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    })
  }
}

for (const design of designs) {
  for (const viewport of [...viewports, { width: 768, height: 1024 }]) {
    test(`mobile pages: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport)
      const failures = []
      for (const route of ['/home', '/articles', '/articles/aaaaaaaaaaaaaaaaaaaaaaaa', '/articles/new', '/moments', '/moments/bbbbbbbbbbbbbbbbbbbbbbbb', '/moments/new', '/gallery', '/archive', '/about', '/lab', '/notice', '/terms', '/login']) {
        if (process.env.MOBILE_DEBUG) console.log(design, viewport.width, route)
        if (route.endsWith('/new')) {
          // A fixture rotates its token on every SSE subscription. Authenticate
          // after unloading the old page so its in-flight session responses
          // cannot overwrite the new login's cookie.
          await page.goto('about:blank')
          const response = await page.context().request.post(`${baseURL}/api/auth/login`, {
            data: { username: `editor-${design}-${viewport.width}-${Date.now()}`, password: 'fixture-password' },
          })
          assert.equal(response.status(), 200)
        }
        await visit(page, route)
        if (route.endsWith('/new')) await page.locator('form textarea').waitFor()
        await page.evaluate(() => document.fonts.ready)
        const overflow = await page.evaluate(() => {
          const width = innerWidth
          const selectors = 'main h1, main h2, main h3, main p, main button, main input, main textarea, footer a, footer button'
          return [...document.querySelectorAll(selectors)].flatMap(el => {
            const box = el.getBoundingClientRect()
            if (!box.width || !box.height || getComputedStyle(el).visibility === 'hidden') return []
            if (el.closest('pre, table, [class*="tool-frame"]')) return []
            if (box.left >= -1 && box.right <= width + 1) return []
            return [{ text: el.textContent?.slice(0, 45), element: el.tagName, left: Math.round(box.left), right: Math.round(box.right) }]
          })
        })
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        if (overflow.length || scrollWidth > viewport.width) failures.push({ route, overflow, scrollWidth })
        if (process.env.MOBILE_SCREENSHOT_DIR && ['/home', '/login'].includes(route)) {
          await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-${viewport.width}-${route.slice(1)}.png`, fullPage: true }).catch(() => {})
        }
      }
      assert.deepEqual(failures, [], 'Content and controls stay within the viewport')
    })
  }
}

async function assertChatRows(page) {
  await expect.poll(() => page.locator('[class*="message-row"]').count()).toBeGreaterThan(1)
  const rows = await page.locator('[class*="message-row"]').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { top: box.top, bottom: box.bottom }
  }).sort((a, b) => a.top - b.top))
  assert(rows.length > 1, 'History is rendered')
  for (let i = 1; i < rows.length; i++) assert(rows[i].top >= rows[i - 1].bottom - 1, 'Virtualized messages do not overlap')
  await expect.poll(() => page.getByRole('log').evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight), { message: 'Latest message stays visible' }).toBeLessThan(65)
}

for (const design of designs) {
  for (const viewport of [...viewports, { width: 1280, height: 800 }]) {
    test(`mobile chat: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport)
      await visit(page, '/chat')
      const log = page.getByRole('log')
      await expect(log.locator('[class*="message-row"]').first()).toBeVisible()
      await expect.poll(() => log.evaluate(el => el.clientHeight)).toBeGreaterThan(70)
      await fitsViewport(page.locator('[class*="chat-compose"]'), viewport, 'Composer')
      await assertChatRows(page)
      // Loading earlier history must retain the content currently in view.
      await log.hover()
      await page.mouse.wheel(0, -10000)
      await expect.poll(() => log.evaluate(el => el.scrollTop)).toBe(0)
      const anchor = await log.locator('[class*="message-row"]').first().evaluate(el => ({
        id: el.dataset.messageId, text: el.textContent, top: el.getBoundingClientRect().top,
      }))
      await log.getByRole('button', { name: '更早的消息' }).click()
      const retained = log.locator(`[data-message-id="${anchor.id}"]`)
      await expect(retained).toHaveText(anchor.text)
      await expect.poll(async () => Math.abs((await retained.boundingBox()).y - anchor.top), { message: 'Earlier history preserves the scroll anchor' }).toBeLessThan(4)
      const input = page.locator('[class*="chat-compose"] textarea')
      const message = `手机端多行消息 ${design}-${viewport.width}-${Date.now()}\n第二行`
      await input.fill(message)
      await page.locator('[class*="chat-compose"]').getByRole('button', { name: '发送', exact: true }).click()
      await expect(input).toHaveValue('')
      await expect(log.getByText(message, { exact: true })).toBeVisible()
      await assertChatRows(page)
      if (viewport.width < 640) {
        const keyboardViewport = { ...viewport, height: 400 }
        await page.setViewportSize(keyboardViewport)
        await input.focus()
        await fitsViewport(page.locator('[class*="chat-compose"]'), keyboardViewport, 'Composer with reduced viewport')
        await expect.poll(() => log.evaluate(el => el.clientHeight)).toBeGreaterThan(45)
        await page.setViewportSize(viewport)
        await assertChatRows(page)
        // Safari can shrink/pan only visualViewport while CSS viewport units
        // and height media queries still describe the original screen.
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: 400 })
          Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 30 })
          visualViewport.dispatchEvent(new Event('resize'))
          visualViewport.dispatchEvent(new Event('scroll'))
        })
        await expect.poll(() => page.locator('[class*="blog-root"]').evaluate(el => el.getBoundingClientRect().height)).toBe(400)
        const visualBounds = await page.locator('[class*="chat-compose"]').boundingBox()
        assert(visualBounds.y >= 30 && visualBounds.y + visualBounds.height <= 431, 'Composer stays above the keyboard when only visualViewport changes')
        await expect.poll(() => log.evaluate(el => el.clientHeight)).toBeGreaterThan(45)
        await page.getByRole('button', { name: '放大聊天界面', exact: true }).tap()
        const expandedBounds = await page.locator('[class*="chat-compose"]').boundingBox()
        assert(expandedBounds.y >= 30 && expandedBounds.y + expandedBounds.height <= 431, 'Expanded composer uses the visible viewport')
        await page.getByRole('button', { name: '还原聊天界面', exact: true }).tap()
        await page.evaluate(() => {
          delete visualViewport.height
          delete visualViewport.offsetTop
          visualViewport.dispatchEvent(new Event('resize'))
          visualViewport.dispatchEvent(new Event('scroll'))
        })
        await assertChatRows(page)
      }
      await page.getByRole('button', { name: '放大聊天界面', exact: true }).tap()
      await expect(page.locator('[class*="chat-page"]')).toHaveAttribute('data-expanded', 'true')
      await fitsViewport(page.locator('[class*="chat-compose"]'), viewport, 'Expanded composer')
      await page.getByRole('button', { name: '还原聊天界面', exact: true }).tap()
      await page.locator('[class*="conversation-list"]').getByRole('button', { name: '与作者通信', exact: true }).tap()
      await expect(page).toHaveURL(/conversation=admin/)
      await expect(page.getByRole('log')).toHaveAttribute('aria-label', '与作者通信')
      if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-${viewport.width}-chat.png` }).catch(() => {})
    })
  }
}

for (const design of designs) {
  test(`mobile publishing: ${design}`, async t => {
    const { page } = await session(t, design, { width: 390, height: 844 })
    await visit(page, '/articles/new')
    const title = `手机发布 ${design} ${Date.now()}`
    await page.getByLabel('标题', { exact: true }).fill(title)
    await page.getByLabel('标签（逗号分隔）', { exact: true }).fill('手机，回归,测试')
    await page.getByLabel('内容 / Markdown', { exact: true }).fill('第一行\n第二行')
    await page.getByRole('button', { name: '发布', exact: true }).tap()
    await expect(page).toHaveURL(/\/articles\/[a-f0-9]{24}$/)
    await expect(page.locator('h1')).toHaveText(title)
    await expect(page.locator('[class*="markdown"] p')).toHaveText('第一行\n第二行')
    await expect(page.locator('[class*="tags"] span')).toHaveText(['手机', '回归', '测试'])
    await visit(page, '/moments/new')
    const fragment = `手机片刻 ${design} ${Date.now()}`
    await page.getByLabel('标题', { exact: true }).fill(fragment)
    await page.getByLabel('内容 / Markdown', { exact: true }).fill('第三行\n第四行')
    await page.getByRole('button', { name: '发布', exact: true }).tap()
    await expect(page).toHaveURL(/\/moments\/[a-f0-9]{24}$/)
    await expect(page.locator('h1')).toHaveText(fragment)
    await expect(page.locator('[class*="markdown"] p')).toHaveText('第三行\n第四行')
  })
}

async function fitsViewport(locator, viewport, message) {
  const box = await locator.boundingBox()
  assert(box && box.x >= -1 && box.x + box.width <= viewport.width + 1, `${message}: horizontal bounds`)
  assert(box.y >= -1 && box.y + box.height <= viewport.height + 1, `${message}: vertical bounds`)
}

for (const design of designs) {
  for (const viewport of viewports) {
    test(`mobile navigation: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport)
      await visit(page, '/articles')
      await fitsViewport(page.locator('[class*="site-header"]'), viewport, 'Header')
      const appearance = page.getByRole('button', { name: '外观', exact: true })
      await appearance.tap()
      const panel = page.locator('[class*="theme-panel"]')
      await expect(panel).toBeVisible()
      await fitsViewport(panel, viewport, 'Appearance panel')
      await page.getByRole('button', { name: '关闭外观设置' }).tap()
      await expect(panel).toHaveCount(0)
      const opener = page.getByRole('button', { name: '打开导航', exact: true })
      if (!await opener.isVisible()) {
        assert(viewport.width > 820, 'Phone navigation must be available')
        return
      }
      await opener.tap()
      const dialog = page.locator('dialog[open]')
      await expect(dialog).toBeVisible()
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      const nav = dialog.locator('nav')
      const links = nav.locator('a')
      assert.equal(await links.count(), 8, 'Every destination is available')
      for (const link of await links.all()) {
        await link.scrollIntoViewIfNeeded()
        await fitsViewport(link, viewport, await link.textContent())
      }
      await dialog.getByRole('button', { name: '关闭', exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      await expect(opener).toBeFocused()
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await opener.tap()
      await page.keyboard.press('Escape')
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      await opener.tap()
      await page.locator('dialog[open] nav a[href="/moments"]').tap()
      await expect(page).toHaveURL(`${baseURL}/moments`)
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    })
  }
}
