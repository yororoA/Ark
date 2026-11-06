import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10580'
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => browser?.close())

async function session(t, width, mode, register = false, accounts = []) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 780 : 1000 }, colorScheme: mode, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(mode => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': 'voyage', 'ark.theme': mode, 'ark.locale': 'zh', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
  }, mode)
  const calls = []
  let release
  const pending = new Promise(resolve => { release = resolve })
  t.after(() => release())
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname === '/api/session') return route.fulfill({ json: url.searchParams.has('all') ? { data: accounts, activeUid: accounts[0]?.uid || null } : { data: accounts[0] || null } })
    if (request.method() !== 'GET') {
      calls.push({ path: url.pathname, body: request.postDataJSON() })
      if (url.pathname === '/api/auth/code') return route.fulfill({ json: { status: 'ok' } })
      await pending
      return route.fulfill({ status: 401, json: { message: 'Fixture credentials rejected' } })
    }
    return route.continue()
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.goto(`${baseURL}/login${register ? '?mode=register' : ''}`, { waitUntil: 'networkidle' })
  if (accounts.length) await page.getByRole('button', { name: '管理账号', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '账号管理' })
  await expect(dialog).toBeVisible()
  return { page, dialog, calls, release }
}

for (const [width, mode] of [[1440, 'light'], [320, 'dark']]) test(`Login Enter uses existing validation and sends one request: ${width}px ${mode}`, async t => {
  const { page, dialog, calls, release } = await session(t, width, mode)
  await page.getByLabel('用户名', { exact: true }).press('Enter')
  await expect(dialog.getByRole('alert')).toHaveText('请输入用户名')
  assert.equal(calls.length, 0)
  await page.getByLabel('用户名', { exact: true }).fill('fixture-reviewer')
  await page.getByLabel('密码', { exact: true }).press('Enter')
  await expect(dialog.getByRole('alert')).toHaveText('请输入密码')
  assert.equal(calls.length, 0)
  await page.getByLabel('密码', { exact: true }).fill('fixture-password')
  await page.getByLabel('密码', { exact: true }).press('Enter')
  await expect.poll(() => calls.length).toBe(1)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  assert.equal(calls.length, 1, 'Repeated Enter while connecting does not submit another login')
  assert.deepEqual(calls[0], { path: '/api/auth/login', body: { username: 'fixture-reviewer', password: 'fixture-password' } })
  release()
  await expect(page.locator('p[role="alert"]')).toHaveText('Fixture credentials rejected')
  await page.getByRole('button', { name: /^返回登录/ }).last().click()
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('用户名', { exact: true })).toHaveValue('fixture-reviewer')
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveCount(0)
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  assert.equal(stored.includes('fixture-reviewer'), false, 'Rejected identity remains in this page memory only')
  assert.equal(stored.includes('fixture-password'), false)
  assert.equal(new URL(page.url()).pathname, '/login')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
})

test('Registration Enter submits registration while the code button only sends a code', async t => {
  const { page, dialog, calls, release } = await session(t, 320, 'dark')
  await dialog.getByRole('button', { name: '注册', exact: true }).click()
  await page.getByLabel('用户名', { exact: true }).fill('fixture-reviewer')
  await page.getByLabel('密码', { exact: true }).fill('fixture-password')
  await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test')
  await page.getByLabel('邮箱', { exact: true }).press('Enter')
  await expect(dialog.getByRole('alert')).toHaveText('请输入验证码')
  assert.equal(calls.length, 0)
  await dialog.getByRole('button', { name: '获取验证码', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('status')).toHaveText('验证码已发送，请查看邮箱。')
  assert.deepEqual(calls, [{ path: '/api/auth/code', body: { email: 'fixture@example.test' } }])
  await page.getByLabel('验证码', { exact: true }).fill('123456')
  await page.getByLabel('验证码', { exact: true }).press('Enter')
  await expect.poll(() => calls.length).toBe(2)
  assert.deepEqual(calls[1], { path: '/api/auth/register', body: { username: 'fixture-reviewer', password: 'fixture-password', email: 'fixture@example.test', verificationCode: '123456' } })
  release()
  await expect(page.locator('p[role="alert"]')).toHaveText('Fixture credentials rejected')
  await page.getByRole('button', { name: /^返回登录/ }).last().click()
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('用户名', { exact: true })).toHaveValue('fixture-reviewer')
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('fixture@example.test')
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('验证码', { exact: true })).toHaveValue('')
  assert.equal(new URL(page.url()).searchParams.get('mode'), null, 'Registration retry follows the submitted tab, not the URL default')
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  for (const field of ['fixture-reviewer', 'fixture@example.test', 'fixture-password', '123456']) assert.equal(stored.includes(field), false)
})

test('Returning to saved accounts or closing account management clears rejected form identity', async t => {
  const account = { uid: 'fixture-saved', username: 'Saved account', isGuest: false, isAdmin: false }
  const { page, dialog, release } = await session(t, 320, 'light', false, [account])
  release()
  for (const exit of ['返回账号列表', '关闭账号管理']) {
    await dialog.getByRole('button', { name: '其他账号登录', exact: true }).click()
    await dialog.getByRole('button', { name: '注册', exact: true }).click()
    await page.getByLabel('用户名', { exact: true }).fill('rejected-identity')
    await page.getByLabel('密码', { exact: true }).fill('fixture-password')
    await page.getByLabel('邮箱', { exact: true }).fill('rejected@example.test')
    await page.getByLabel('验证码', { exact: true }).fill('123456')
    await page.getByLabel('验证码', { exact: true }).press('Enter')
    await expect(page.locator('p[role="alert"]')).toHaveText('Fixture credentials rejected')
    await page.getByRole('button', { name: /^返回登录/ }).last().click()
    await expect(page.getByLabel('用户名', { exact: true })).toHaveValue('rejected-identity')
    await dialog.getByRole('button', { name: exit, exact: true }).click()
    if (exit === '关闭账号管理') await page.getByRole('button', { name: '管理账号', exact: true }).click()
    await dialog.getByRole('button', { name: '其他账号登录', exact: true }).click()
    await expect(page.getByLabel('用户名', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('邮箱', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: '注册', exact: true }).click()
    await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('')
    await dialog.getByRole('button', { name: '返回账号列表', exact: true }).click()
  }
})
