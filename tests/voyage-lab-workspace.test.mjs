import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10580'
if (!/^http:\/\/127\.0\.0\.1:(10580|10590)$/.test(baseURL)) throw new Error('Lab checks require an isolated local preview')
const artifacts = process.env.ARK_LAB_ARTIFACTS
let browser
before(async () => { browser = await chromium.launch({ headless: true }); if (artifacts) await mkdir(artifacts, { recursive: true }) })
after(async () => browser?.close())

async function session(t, { width = 390, height = 844, mode = 'light', design = 'voyage', locale = 'zh', engine = 'pass', motion = 'reduce' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: mode, reducedMotion: motion })
  t.after(() => context.close())
  await context.addInitScript(({ mode, design, locale }) => {
    try {
      for (const [key, value] of Object.entries({ 'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': locale, 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
    } catch { /* The sandboxed tool deliberately has no storage access. */ }
  }, { mode, design, locale })
  const state = { engine, documents: 0, writes: [] }
  let release
  const gate = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname === '/api/session') return route.fulfill({ json: url.searchParams.has('all') ? { data: [], activeUid: null } : { data: null } })
    if (request.method() !== 'GET') { state.writes.push(url.pathname); return route.fulfill({ json: { data: {} } }) }
    return route.continue()
  })
  await context.route('**/lab/function-speed-player.html', route => { state.documents++; return route.continue() })
  await context.route('**/lab/main.js', async route => {
    if (state.engine === 'hold') await gate
    if (state.engine === 'fail') return route.abort('failed')
    if (state.engine === 'throw') return route.fulfill({ contentType: 'application/javascript', body: 'throw new Error("Fixture initialization failed")' })
    return route.continue()
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => {
    if (engine === 'throw' && error.message.includes('Fixture initialization failed')) return
    errors.push(error.message)
  })
  t.after(() => assert.deepEqual(errors, [], 'No unexpected runtime errors'))
  await page.goto(`${baseURL}/lab`, { waitUntil: 'networkidle' })
  const opener = page.locator('button[aria-controls="lab-workspace"]'), workspace = page.getByTestId('voyage-lab-workspace')
  t.after(() => assert.deepEqual(state.writes, []))
  return { page, opener, workspace, state, release }
}

for (const config of [
  { width: 320, height: 568, mode: 'light' },
  { width: 320, height: 780, mode: 'dark' },
  { width: 390, height: 844, mode: 'light' },
  { width: 1440, height: 1000, mode: 'light', motion: 'no-preference' },
  { width: 844, height: 390, mode: 'dark' },
]) test(`Lab opens below chrome and returns to the exact opener: ${config.width}×${config.height} ${config.mode}`, async t => {
  const { page, opener, workspace, state } = await session(t, config)
  await opener.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => scrollY)
  await opener.click()
  await expect(opener).toHaveAttribute('aria-expanded', 'true')
  await expect(workspace).toHaveAttribute('data-status', 'ready')
  await expect(workspace.getByRole('heading')).toBeFocused()
  await expect(workspace.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts')
  const geometry = await workspace.evaluate(element => {
    const rect = element.getBoundingClientRect(), header = document.querySelector('[data-blog-root] > header').getBoundingClientRect()
    const root = document.querySelector('[data-blog-root]'), bottom = parseFloat(getComputedStyle(root).getPropertyValue('--app-nav-height')) || 0
    const frame = element.querySelector('iframe').getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom, header: header.bottom, availableBottom: innerHeight - bottom, frameHeight: frame.height, overflow: document.documentElement.scrollWidth > innerWidth }
  })
  assert.ok(geometry.top >= geometry.header - 1)
  assert.ok(geometry.top <= geometry.header + 18)
  assert.ok(geometry.bottom <= geometry.availableBottom + 1)
  assert.ok(geometry.frameHeight > (config.height < 500 ? 130 : config.height < 600 ? 240 : 400))
  assert.equal(geometry.overflow, false)
  const tool = page.frameLocator('iframe')
  await expect(tool.locator('html')).toHaveAttribute('data-design', 'voyage')
  assert.equal(await tool.locator('body').evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await expect(tool.locator('#fileInput')).not.toBeFocused()
  await expect.poll(() => workspace.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0)
  if (artifacts) await page.screenshot({ path: `${artifacts}/lab-ready-${config.width}-${config.height}-${config.mode}.png` })
  await workspace.getByRole('button', { name: '关闭工作区', exact: true }).click()
  await expect(workspace).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 2)
  assert.equal(state.documents, 1)
})

test('Appearance messages preserve the loaded tool state and reject unsupported configuration', async t => {
  const { page, opener, workspace, state } = await session(t)
  await opener.click()
  await expect(workspace).toHaveAttribute('data-status', 'ready')
  const tool = page.frameLocator('iframe')
  await tool.locator('#formulaInput').fill('t / d + 1')
  await page.evaluate(() => {
    localStorage.setItem('ark.theme', 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: 'ark.theme', storageArea: localStorage }))
  })
  await expect(tool.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(tool.locator('#formulaInput')).toHaveValue('t / d + 1')
  assert.equal(state.documents, 1, 'Theme changes do not reload the frame or discard local tool state')
  await page.evaluate(() => document.querySelector('iframe').contentWindow.postMessage({ type: 'ark:lab:configure', design: 'voyage', mode: 'unsupported' }, '*'))
  await expect(tool.locator('html')).toHaveAttribute('data-theme', 'dark')
  await tool.locator('body').evaluate(() => window.postMessage({ type: 'ark:lab:configure', design: 'voyage', mode: 'light' }, '*'))
  await page.waitForTimeout(50)
  await expect(tool.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 1000 })
})

test('Slow loading waits for the engine handshake and closing cancels pending status and focus work', async t => {
  const { page, opener, workspace, state, release } = await session(t, { engine: 'hold' })
  await opener.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => scrollY)
  await opener.click()
  await expect(workspace).toHaveAttribute('data-status', 'loading')
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-design', 'voyage')
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'light')
  await page.evaluate(() => window.postMessage({ type: 'ark:lab:status', status: 'ready' }, '*'))
  await expect(workspace).toHaveAttribute('data-status', 'loading')
  await expect(workspace).toHaveAttribute('data-status', 'slow', { timeout: 8000 })
  await expect(workspace.getByRole('link', { name: '在新窗口打开工具' })).toHaveAttribute('target', '_blank')
  await expect(workspace.getByRole('button', { name: '重新载入' })).toBeVisible()
  if (artifacts) await page.screenshot({ path: `${artifacts}/lab-slow-390-light.png` })
  await workspace.getByRole('button', { name: '关闭工作区' }).click()
  state.engine = 'pass'; release()
  await page.waitForTimeout(200)
  await expect(opener).toBeFocused()
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 2)
  await expect(workspace).toHaveCount(0)
  await opener.click()
  await expect(workspace).toHaveAttribute('data-status', 'ready')
})

test('Rapid closing during the entrance leaves no delayed scroll or focus change', async t => {
  const { page, opener, workspace } = await session(t, { width: 390, motion: 'no-preference' })
  await opener.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => scrollY)
  for (let attempt = 0; attempt < 3; attempt++) {
    await opener.click()
    await workspace.getByRole('button', { name: '关闭工作区' }).click({ force: true })
    await expect(workspace).toHaveCount(0)
    await expect(opener).toBeFocused()
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 2)
  }
  await page.waitForTimeout(350)
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(opener).toBeFocused()
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 2)
})

for (const engine of ['fail', 'throw']) test(`Engine ${engine} does not become ready merely because iframe load completed`, async t => {
  const { page, opener, workspace, state } = await session(t, { engine })
  await opener.click()
  await expect(workspace).toHaveAttribute('data-status', 'failed')
  if (artifacts && engine === 'fail') await page.screenshot({ path: `${artifacts}/lab-failed-390-light.png` })
  state.engine = 'pass'
  await workspace.getByRole('button', { name: '重新载入', exact: true }).click()
  await expect(workspace).toHaveAttribute('data-status', 'ready')
  assert.equal(state.documents, 2)
})

for (const design of ['archive', 'rain', 'p3r', 'prism', 'allotype', 'fold']) test(`Other themes keep the original frame and tool colours: ${design}`, async t => {
  const { page, opener, workspace } = await session(t, { design })
  await opener.click()
  await expect(workspace).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(page.frameLocator('iframe').locator('#formulaInput')).toBeVisible()
  assert.equal(await page.frameLocator('iframe').locator('html').getAttribute('data-design'), null)
  assert.equal(await page.frameLocator('iframe').locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(15, 23, 42)')
})

for (const [locale, name] of [['en', 'Variable-speed workspace'], ['ja', '関数変速ワークスペース'], ['de', 'Arbeitsbereich für variable Geschwindigkeit']]) test(`Workspace outer labels follow ${locale}`, async t => {
  const { page, opener, workspace } = await session(t, { locale, width: 320, height: 780 })
  await opener.click()
  await expect(workspace).toHaveAttribute('data-status', 'ready')
  await expect(workspace.getByRole('heading', { name, exact: true })).toBeFocused()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})
