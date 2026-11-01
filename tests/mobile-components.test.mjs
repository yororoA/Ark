import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test')
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const designs = ['archive', 'rain', 'p3r', 'prism']
const phone = { width: 320, height: 568 }
let browser

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  })
})
after(async () => { await browser?.close() })

async function session(t, design, viewport = phone, { admin = false, locale = 'de', identity = 'user' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(({ design, locale }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    try {
      localStorage.setItem('ark.design.v1', design)
      localStorage.setItem('ark.locale', locale)
      localStorage.setItem('ark.theme', 'dark')
      localStorage.setItem('ark.mascot:v1', 'off')
    } catch { /* Sandboxed laboratory frames intentionally have no storage. */ }
  }, { design, locale })
  if (identity !== 'anonymous') {
    const response = await context.request.post(`${baseURL}/api/auth/${identity === 'guest' ? 'guest' : 'login'}`, {
      data: identity === 'guest' ? {} : { username: admin ? 'tester' : `components-${design}-${Date.now()}`, password: 'fixture-password' },
    })
    assert.equal(response.status(), 200, 'Use the isolated verify:blog:preview fixture')
  }
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(60000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { page, context }
}

async function visit(page, route) {
  await page.goto(`${baseURL}${route}`)
  await page.locator('h1:visible').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('[class*="account-links"]').waitFor({ state: 'attached' })
}

async function horizontalBounds(root, width, label) {
  const problems = await root.locator('h1,h2,h3,p,label,input,textarea,select,button,a,progress').evaluateAll((elements, width) => elements.flatMap(element => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    if (!box.width || !box.height || style.visibility === 'hidden' || element.closest('pre,table')) return []
    return box.left < -1 || box.right > width + 1 ? [{ tag: element.tagName, text: element.textContent?.slice(0, 60), left: box.left, right: box.right }] : []
  }), width)
  assert.deepEqual(problems, [], label)
}

async function keyboard(page, height, offsetTop = 0) {
  await page.evaluate(({ height, offsetTop }) => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, value: height })
    Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: offsetTop })
    visualViewport.dispatchEvent(new Event('resize'))
    visualViewport.dispatchEvent(new Event('scroll'))
  }, { height, offsetTop })
}

async function restoreKeyboard(page) {
  await page.evaluate(() => {
    delete visualViewport.height
    delete visualViewport.offsetTop
    visualViewport.dispatchEvent(new Event('resize'))
    visualViewport.dispatchEvent(new Event('scroll'))
  })
}

for (const design of designs) {
  test(`mobile component forms: ${design}`, async t => {
    const { page } = await session(t, design, phone, { admin: true, locale: 'en' })
    await visit(page, '/about')
    const opener = page.getByRole('button', { name: 'Add link', exact: true })
    await opener.tap()
    const dialog = page.getByRole('dialog', { name: 'Add link', exact: true })
    await expect(dialog).toBeVisible()
    await keyboard(page, 360, 20)
    await expect.poll(() => dialog.evaluate(el => {
      const box = el.getBoundingClientRect()
      return box.top >= 20 && box.bottom <= 380
    }), { message: 'Link editor stays in the visible area above the keyboard' }).toBe(true)
    for (const input of await dialog.locator('label[class*="field"] > input, label[class*="field"] > textarea').all()) {
      await input.scrollIntoViewIfNeeded()
      assert.equal(await input.evaluate(el => getComputedStyle(el).fontSize), '16px')
      const box = await input.boundingBox()
      assert(box.y >= 20 && box.y + box.height <= 381)
    }
    const category = dialog.getByRole('combobox', { name: 'Category', exact: true })
    await category.scrollIntoViewIfNeeded()
    await category.tap()
    await expect(page.getByRole('listbox')).toBeVisible()
    await horizontalBounds(page.getByRole('listbox'), phone.width, 'Nested select')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded()
    await horizontalBounds(dialog, phone.width, 'Link form')
    await dialog.getByRole('button', { name: 'Close', exact: true }).tap()
    await expect(opener).toBeFocused()
    await restoreKeyboard(page)
  })

  test(`mobile component uploads: ${design}`, async t => {
    const { page, context } = await session(t, design, phone, { locale: 'en' })
    await visit(page, '/gallery')
    await page.getByRole('button', { name: 'Upload media', exact: true }).tap()
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    const image = await readFile(new URL('../public/login_light.png', import.meta.url))
    const filename = '手机媒体文件'.repeat(10) + '.png'
    await dialog.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: 'image/png', buffer: image })
    await context.route('**/api/blog/media/upload', route => route.fulfill({ status: 503, json: { message: 'Upload unavailable ' + 'longFailure'.repeat(25) } }))
    await dialog.getByRole('button', { name: 'Upload media', exact: true }).last().tap()
    await expect(dialog.getByRole('alert')).toBeVisible()
    const retry = dialog.getByRole('button', { name: `Try again ${filename}`, exact: true })
    await expect(retry).toBeVisible()
    await horizontalBounds(dialog, phone.width, 'Upload error and retry')
    const fileLabel = dialog.locator('[class*="upload-file-summary"] > span')
    assert((await fileLabel.boundingBox()).width >= 24, 'Filename still has space beside retry/remove controls')
    if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-upload-error.png` })
    await dialog.getByRole('button', { name: `Remove attachment ${filename}`, exact: true }).tap()
    await expect(dialog.locator('[class*="upload-files"]')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Close', exact: true }).tap()
  })

  test(`mobile component comments and errors: ${design}`, async t => {
    const { page, context } = await session(t, design, phone, { locale: 'en' })
    await context.route('**/api/blog/moments/comment/get', route => route.fulfill({ json: { data: [{
      _id: 'cccccccccccccccccccccccc', username: 'LongUser'.repeat(25),
      content: 'LongComment'.repeat(80), createdAt: '2026-10-01T12:00:00Z',
    }] } }))
    await visit(page, '/moments/bbbbbbbbbbbbbbbbbbbbbbbb')
    const comment = page.locator('[class*="comment_"]').filter({ has: page.getByRole('button', { name: 'Reply', exact: true }) })
    await comment.getByRole('button', { name: 'Reply', exact: true }).tap()
    await expect(page.getByRole('textbox', { name: 'Comments', exact: true })).toBeFocused()
    await horizontalBounds(page.locator('main'), phone.width, 'Long comments, reply banner, and authors')
    await page.locator('[class*="reply-target"]').getByRole('button', { name: 'Cancel' }).tap()
    await expect(page.locator('[class*="reply-target"]')).toHaveCount(0)
    let recover = false
    await context.route('**/api/blog/gallery/get?*', route => recover
      ? route.continue()
      : route.fulfill({ status: 503, json: { message: 'LongError'.repeat(80) } }))
    await visit(page, '/gallery')
    await expect(page.locator('main').getByRole('alert')).toBeVisible()
    await horizontalBounds(page.locator('main'), phone.width, 'Actionable service error')
    await page.getByRole('button', { name: 'Try again', exact: true }).scrollIntoViewIfNeeded()
    // Keep the error stable during actionability checks, including SWR retries.
    await page.getByRole('button', { name: 'Try again', exact: true }).tap({ trial: true })
    recover = true
    const response = page.waitForResponse(response => response.url().includes('/api/blog/gallery/get?') && response.status() === 200)
    await page.getByRole('button', { name: 'Try again', exact: true }).tap()
    await response
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
  })

  test(`mobile component laboratory: ${design}`, async t => {
    const { page } = await session(t, design, phone, { locale: 'en' })
    await visit(page, '/lab')
    await page.getByRole('button', { name: 'Open speed player', exact: true }).tap()
    const frame = page.frameLocator('iframe')
    await frame.locator('#formulaInput').waitFor()
    const frameWidth = await frame.locator('html').evaluate(el => el.clientWidth)
    await horizontalBounds(frame.locator('body'), frameWidth, 'Embedded player')
    assert.equal(await frame.locator('html').evaluate(el => el.scrollWidth), frameWidth)
    for (const selector of ['#formulaInput', '#maxSpeedInput', '#inputModeSelect']) {
      assert.equal(await frame.locator(selector).evaluate(el => getComputedStyle(el).fontSize), '16px')
    }
    await frame.locator('#inputModeSelect').selectOption('draw')
    await page.locator('iframe').scrollIntoViewIfNeeded()
    await frame.locator('#sourceCanvas').scrollIntoViewIfNeeded()
    const canvas = await frame.locator('#sourceCanvas').boundingBox()
    await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
    await frame.locator('#clearDrawBtn').tap()
    await frame.locator('#inputModeSelect').selectOption('preset')
    await frame.locator('#presetSelect').selectOption('linear')
    await frame.locator('#media').scrollIntoViewIfNeeded()
    const player = await frame.locator('#media').boundingBox()
    const iframe = await page.locator('iframe').boundingBox()
    assert(player.x >= iframe.x && player.x + player.width <= iframe.x + iframe.width + 1, 'Player remains reachable')
    await page.getByRole('button', { name: 'Close', exact: true }).tap()
    await expect(page.locator('iframe')).toHaveCount(0)
  })
}

for (const design of designs) {
  for (const viewport of [phone, { width: 390, height: 844 }, { width: 640, height: 800 }, { width: 768, height: 1024 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1100, height: 600 }]) {
    test(`mobile dedicated menu: ${design} ${viewport.width}×${viewport.height}`, async t => {
      const { page } = await session(t, design, viewport)
      await visit(page, '/articles')
      await page.getByRole('button', { name: 'Menü öffnen', exact: true }).tap()
      const dialog = page.locator('dialog[open]')
      await expect(dialog).toBeVisible()
      for (const link of await dialog.locator('nav a').all()) {
        await link.scrollIntoViewIfNeeded()
        const box = await link.boundingBox()
        assert(box.x >= -1 && box.x + box.width <= viewport.width + 1, 'Destination stays inside the screen')
        assert(box.y >= -1 && box.y + box.height <= viewport.height + 1, 'Destination can be scrolled fully into view')
      }
      await horizontalBounds(dialog.locator('nav'), viewport.width, 'Menu labels')
      await page.setViewportSize({ width: 390, height: 844 })
      await horizontalBounds(dialog.locator('nav'), 390, 'Menu after orientation change')
      await dialog.getByRole('button', { name: 'Schließen', exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    })
  }
}

for (const design of designs) {
  test(`mobile extended article editing: ${design}`, async t => {
    const { page, context } = await session(t, design, phone, { locale: 'en' })
    await visit(page, '/articles/new')
    const title = `Editable ${design} ${Date.now()}`
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    const content = page.getByRole('textbox', { name: 'Content / Markdown', exact: true })
    const text = 'Before media\nAfter media\n' + 'Words that wrap across the narrow screen. '.repeat(80)
    await content.fill(text)
    await page.setViewportSize({ width: 844, height: 390 })
    await expect.poll(() => content.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2)
    const landscapeHeight = (await content.boundingBox()).height
    await page.setViewportSize(phone)
    await expect.poll(() => content.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2)
    assert((await content.boundingBox()).height > landscapeHeight, 'Orientation updates wrapped textarea height')
    await page.getByRole('button', { name: 'Publish', exact: true }).tap()
    await expect(page).toHaveURL(/\/articles\/[a-f0-9]{24}$/)
    await page.getByRole('link', { name: 'Edit', exact: true }).tap()
    await expect(content).toHaveValue(text)
    await content.focus()
    // Selection is browser state, while upload and save use the real controls.
    await content.evaluate(el => { el.setSelectionRange(12, 12); el.dispatchEvent(new Event('select', { bubbles: true })) })
    await context.route('**/api/blog/media/upload', route => route.fulfill({ json: { data: {
      id: 'eeeeeeeeeeeeeeeeeeeeeeee', scope: 'article', filename: 'cursor.png',
      mime: 'image/png', url: `${baseURL}/login_light.png`, bytes: 100, status: 'staged',
    } } }))
    const image = await readFile(new URL('../public/login_light.png', import.meta.url))
    await page.locator('input[type="file"]').setInputFiles({ name: 'cursor.png', mimeType: 'image/png', buffer: image })
    await page.getByRole('button', { name: 'Insert media', exact: true }).tap()
    const markdown = `![cursor.png](${baseURL}/login_light.png)`
    await expect(content).toHaveValue(text.slice(0, 12) + markdown + text.slice(12))
    await expect(content).toBeFocused()
    assert.equal(await content.evaluate(el => el.selectionStart), 12 + markdown.length)
    await page.getByRole('button', { name: 'Save', exact: true }).tap()
    await expect(page).toHaveURL(/\/articles\/[a-f0-9]{24}$/)
    await expect(page.locator('[class*="markdown"] img')).toHaveAttribute('src', `${baseURL}/login_light.png`)
    await horizontalBounds(page.locator('main'), phone.width, 'Saved article actions')
  })

  test(`mobile extended managed draft: ${design}`, async t => {
    const { page, context } = await session(t, design, phone, { locale: 'en' })
    const filename = '恢复的媒体文件'.repeat(20) + '.png'
    await context.route('**/api/blog/moments/get?isEditing=true*', route => route.fulfill({ json: { data: {
      _id: 'eeeeeeeeeeeeeeeeeeeeeeee', uid: 'draft-user', title: 'Restored draft',
      content: 'Line one\nLine two', createdAt: '2026-10-01T12:00:00Z', acknowledge: true,
      filenames: { [filename]: `${baseURL}/login_light.png` },
      filesDetail: { [filename]: { assetId: 'ffffffffffffffffffffffff', origin: filename,
        desc: 'Existing alternative text', secure_url: `${baseURL}/login_light.png`, mime: 'image/png' } },
    } } }))
    await visit(page, '/moments/new')
    await page.getByRole('button', { name: 'Restore draft', exact: true }).tap()
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Restored draft')
    const description = page.locator('[class*="media-description-row"] input')
    await expect(description).toHaveValue('Existing alternative text')
    await description.fill('Edited alternative text')
    await page.getByRole('checkbox').uncheck()
    await expect(page.getByRole('checkbox')).not.toBeChecked()
    await horizontalBounds(page.locator('main'), phone.width, 'Restored filename, description, checkbox, and actions')
    if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-managed-draft.png` })
    const save = page.getByRole('button', { name: 'Save draft', exact: true })
    const request = page.waitForRequest(request => request.url().endsWith('/api/blog/moments/post') && request.method() === 'POST')
    await save.tap()
    const payload = (await request).postDataJSON()
    assert.equal(payload.published, false)
    assert.deepEqual(payload.media, [{ assetId: 'ffffffffffffffffffffffff', description: 'Edited alternative text' }])
    await expect(save).toBeEnabled()
    await page.getByRole('button', { name: `Remove attachment ${filename}`, exact: true }).tap()
    await expect(description).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
  })

  test(`mobile extended guestbook and pagination: ${design}`, async t => {
    const { page, context } = await session(t, design, phone, { locale: 'en', identity: 'anonymous' })
    let posted
    await context.route('**/api/blog/guestbook?*', route => {
      const secondPage = new URL(route.request().url()).searchParams.get('page') === '2'
      return route.fulfill({ json: { data: posted ? [posted] : [{
        _id: secondPage ? 'second-page' : 'first-page', username: 'LongName'.repeat(20),
        content: (secondPage ? 'Page two ' : 'Page one ') + 'LongGuestbook'.repeat(100), createdAt: '2026-10-01T12:00:00Z',
      }], pagination: { page: secondPage ? 2 : 1, pages: 2, total: 9 } } })
    })
    await context.route('**/api/blog/guestbook', route => {
      posted = { ...route.request().postDataJSON(), _id: 'new-message', createdAt: '2026-10-01T12:00:00Z' }
      return route.fulfill({ json: { data: posted } })
    })
    await visit(page, '/about')
    const guestbook = page.locator('#guestbook')
    await expect(guestbook.locator('[class*="comment_"] p')).toContainText('Page one')
    await guestbook.getByRole('button', { name: 'Next', exact: true }).tap()
    await expect(guestbook.locator('[class*="comment_"] p')).toContainText('Page two')
    await guestbook.getByRole('textbox', { name: 'Your name', exact: true }).fill('Mobile visitor')
    await guestbook.getByRole('textbox', { name: 'Content', exact: true }).fill('First line\nSecond line')
    await guestbook.getByRole('button', { name: 'Send', exact: false }).tap()
    await expect(guestbook.locator('[class*="comment_"] p')).toHaveText('First line\nSecond line')
    await horizontalBounds(guestbook, phone.width, 'Guestbook content and pagination')
  })

  test(`mobile extended gallery navigation: ${design}`, async t => {
    const { page, context } = await session(t, design, { width: 844, height: 390 }, { locale: 'en' })
    await context.route('**/api/blog/gallery/get?*', route => route.fulfill({ json: { data: {
      files: [
        { filename: 'first.png', desc: 'First image', mime: 'image/png', url: `${baseURL}/login_light.png` },
        { filename: 'clip.mp4', desc: 'Video clip', mime: 'video/mp4', url: `${baseURL}/mobile-fixture.mp4` },
        { filename: 'last.png', desc: 'Last image', mime: 'image/png', url: `${baseURL}/login_dark.png` },
      ], count: 3, hasMore: false, breakpoint: null,
    } } }))
    await visit(page, '/gallery')
    const opener = page.getByRole('button', { name: 'Preview First image', exact: true })
    await opener.tap()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Zoom in', exact: true }).tap()
    await expect(dialog.locator('output')).toHaveText('125%')
    await dialog.getByRole('button', { name: 'Next', exact: true }).tap()
    await expect(dialog.locator('video')).toHaveAttribute('playsinline', '')
    await expect(dialog.locator('video')).toHaveAttribute('controls', '')
    await expect(dialog.locator('output')).toHaveCount(0)
    await horizontalBounds(dialog, 844, 'Landscape video actions')
    await dialog.getByRole('button', { name: 'Next', exact: true }).tap()
    await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
    await expect(dialog.locator('output')).toHaveText('100%')
    await expect.poll(() => dialog.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true)
    await page.setViewportSize(phone)
    await horizontalBounds(dialog, phone.width, 'Media after orientation change')
    if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-gallery-preview.png` })
    await dialog.getByRole('button', { name: 'Close', exact: true }).tap()
    await expect(opener).toBeFocused()
    await page.getByRole('button', { name: 'Videos', exact: true }).tap()
    await expect(page.locator('[class*="gallery-grid"] figure')).toHaveCount(1)
  })

  for (const identity of ['anonymous', 'guest']) {
    test(`mobile extended read-only states: ${design} ${identity}`, async t => {
      const { page } = await session(t, design, phone, { locale: 'de', identity })
      for (const route of ['/articles/new', '/moments/new', '/articles/aaaaaaaaaaaaaaaaaaaaaaaa/edit']) {
        await visit(page, route)
        await expect(page.locator('main form')).toHaveCount(0)
        await expect(page.locator('main a[href^="/login?returnTo="]')).toBeVisible()
        await horizontalBounds(page.locator('main'), phone.width, 'Read-only explanation and sign-in')
      }
    })
  }

  test(`mobile extended appearance and mascot: ${design}`, async t => {
    const { page } = await session(t, design, phone)
    await visit(page, '/articles/new')
    const mascot = page.getByRole('button', { name: '显示桌宠 / Show mascot', exact: true })
    await expect(mascot).toBeVisible()
    const box = await mascot.boundingBox()
    assert(box.width >= 44 && box.height >= 44)
    await page.locator('main input').first().focus()
    await expect(mascot).toBeHidden()
    await page.getByRole('link', { name: 'Darstellung', exact: true }).tap()
    const panel = page.getByTestId('theme-page')
    await expect(panel).toBeVisible()
    for (const value of ['light', 'dark', 'system']) {
      await panel.locator(`label:has(input[value="${value}"])`).tap()
      await expect(panel.locator(`input[value="${value}"]`)).toBeChecked()
      await horizontalBounds(panel, phone.width, 'Appearance choices')
    }
    await page.setViewportSize({ width: 568, height: 320 })
    const systemOption = panel.locator('label:has(input[value="system"])')
    await systemOption.scrollIntoViewIfNeeded()
    const mode = await systemOption.boundingBox()
    assert(mode.y >= 0 && mode.y + mode.height <= 320, 'Mode choices are reachable in a short screen')
    await panel.getByRole('link', { name: 'Zur vorherigen Seite', exact: true }).tap()
    await expect(page).toHaveURL(`${baseURL}/articles/new`)
    await expect(mascot).toBeVisible()
    if (process.env.MOBILE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MOBILE_SCREENSHOT_DIR}/${design}-short-editor.png` })
  })

  test(`mobile extended loading and ownership: ${design}`, async t => {
    const { page } = await session(t, design, phone, { locale: 'en' })
    await visit(page, '/articles/aaaaaaaaaaaaaaaaaaaaaaaa/edit')
    await expect(page.locator('main [class*="error"]')).toHaveText('403')
    await expect(page.locator('main form')).toHaveCount(0)
    await horizontalBounds(page.locator('main'), phone.width, 'Ownership restriction')
    await page.goto(`${baseURL}/test`)
    const text = page.locator('[class*="animationText"]')
    await expect(text).toBeVisible()
    const box = await text.boundingBox()
    assert(box.x >= 0 && box.x + box.width <= phone.width, 'Loading text stays on screen')
    await page.setViewportSize({ width: 568, height: 320 })
    const rotated = await text.boundingBox()
    assert(rotated.x >= 0 && rotated.x + rotated.width <= 568 && rotated.y >= 0 && rotated.y + rotated.height <= 320)
  })
}
