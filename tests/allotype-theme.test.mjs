import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { ALLOTYPES, allotypeMarks, fingerprintPaths } from '../src/lib/allotype.ts'

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:9999'
const shots = process.env.ALLOTYPE_SCREENSHOT_DIR
const account = { uid: 'allotype-visual-fixture', username: '印象访客', isGuest: true, isAdmin: false }
let browser

before(async () => {
  browser = await chromium.launch({ headless: true })
  if (shots) await mkdir(shots, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, { width = 1440, height = 1000, mode = 'light', locale = 'zh', motion = 'reduce', accounts = [] } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion, hasTouch: width <= 640 })
  t.after(() => context.close())
  await context.addInitScript(({ mode, locale, accounts }) => {
    localStorage.setItem('ark.design.v1', 'allotype')
    localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', locale)
    localStorage.setItem('ark.mascot:v1', 'off')
    localStorage.setItem('authDetails', JSON.stringify(accounts))
  }, { mode, locale, accounts })
  // Never create real accounts or mutate the live backend during visual tests.
  await context.route('**/api/session**', route => route.fulfill({
    json: new URL(route.request().url()).searchParams.has('all')
      ? { data: accounts, activeUid: accounts[0]?.uid ?? null }
      : { data: accounts[0] ?? null },
  }))
  await context.route('**/api/auth/**', route => route.fulfill({ json: { ...account, expiresAt: '2099-01-01T00:00:00Z' } }))
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'))
  return { page, context }
}

async function visit(page, path) {
  await page.goto(`${baseURL}${path}`)
  await page.locator('h1:visible').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
}
async function noOverflow(page) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    headings: [...document.querySelectorAll('h1')].filter(el => el.getClientRects().length).map(el => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, scroll: el.scrollWidth, width: el.clientWidth }
    }),
  }))
  assert(result.document <= result.width + 1, `Document overflows: ${JSON.stringify(result)}`)
  for (const heading of result.headings) {
    assert(heading.left >= -1 && heading.right <= result.width + 1, 'Visible heading stays within the viewport')
    assert(heading.scroll <= heading.width + 2, 'Heading text does not overflow its box')
  }
}
async function shot(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false })
}

test('all five supplied seeds produce stable distinct contours; every byte contributes', () => {
  assert.deepEqual(ALLOTYPES.map(seed => seed.value.length * 4), [128, 160, 256, 256, 512])
  const signatures = ALLOTYPES.map(seed => fingerprintPaths(seed.value).join(''))
  assert.equal(new Set(signatures).size, 5)
  ALLOTYPES.forEach((seed, index) => {
    assert.equal(seed.color, `#${seed.value.slice(0, 6)}`)
    assert.equal(fingerprintPaths(seed.value).join(''), signatures[index])
    for (let byte = 0; byte < seed.value.length; byte += 2) {
      const changed = seed.value.slice(0, byte) + (seed.value.slice(byte, byte + 2) === '00' ? 'ff' : '00') + seed.value.slice(byte + 2)
      assert.notEqual(fingerprintPaths(changed).join(''), signatures[index])
    }
  })
})

test('allotypeMarks: five drawing grammars are deterministic and every seed byte changes geometry', () => {
  const signatures = ALLOTYPES.map((seed, form) => allotypeMarks(seed.value, form).map(mark => mark.d).join(''))
  assert.equal(new Set(signatures).size, 5, 'Each supplied seed and form has distinct geometry')
  ALLOTYPES.forEach((seed, form) => {
    const marks = allotypeMarks(seed.value, form)
    assert.deepEqual(allotypeMarks(seed.value, form), marks, `${seed.name} is deterministic`)
    assert(marks.length > 0 && marks.every(mark => mark.d && !/NaN|Infinity/.test(mark.d)), 'Geometry is finite')
    for (let byte = 0; byte < seed.value.length; byte += 2) {
      const original = Number.parseInt(seed.value.slice(byte, byte + 2), 16)
      const changedByte = (original ^ 1).toString(16).padStart(2, '0')
      const changed = seed.value.slice(0, byte) + changedByte + seed.value.slice(byte + 2)
      assert.notEqual(allotypeMarks(changed, form).map(mark => mark.d).join(''), signatures[form],
        `${seed.name}: changing byte ${byte / 2} must affect geometry, not only color`)
    }
  })
})

for (const width of [1440, 768, 390, 320]) {
  for (const mode of ['light', 'dark']) {
    test(`home: ${width}px ${mode}, seed switch and readable controls`, async t => {
      const { page } = await session(t, { width, height: width < 400 ? 844 : 1000, mode })
      await visit(page, '/home')
      await expect(page.getByTestId('allotype-home')).toBeVisible()
      await expect(page.locator('h1:visible')).toHaveCount(1)
      const forms = new Set()
      for (const name of ['MD5', 'SHA-1', 'SHA-256', 'SHA3-256', 'BLAKE2b']) {
        const button = page.getByRole('group', { name: '切换形态' }).getByRole('button', { name: new RegExp(`^${name}(?:\\s*0\\d)?$`) })
        await button.click()
        await expect(button).toHaveAttribute('aria-pressed', 'true')
        await expect(page.locator('[data-form]')).toHaveAttribute('data-form', name)
        forms.add(await page.locator('[data-form] path').first().getAttribute('d'))
        await noOverflow(page)
      }
      assert.equal(forms.size, 5)
      await page.getByRole('button', { name: /^MD5/ }).click()
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await shot(page, `home-${width}-${mode}`)
      await page.getByRole('link', { name: '进入文字', exact: true }).click()
      await expect(page).toHaveURL(/\/articles$/)
      await noOverflow(page)
    })
  }
}

test('normal motion: five rapid form switches settle on the final selection; pause and resume work', async t => {
  const { page } = await session(t, { motion: 'no-preference' })
  await visit(page, '/home')
  const home = page.getByTestId('allotype-home')
  const choices = home.getByRole('group', { name: '切换形态' })
  const art = home.locator('[data-form]')
  // Real clicks with no animation waits between them exercise replacement of
  // a plate while its previous marks are still being drawn.
  for (const name of ['SHA-1', 'SHA-256', 'SHA3-256', 'BLAKE2b', 'MD5']) {
    await choices.getByRole('button', { name, exact: true }).click()
  }
  await expect(choices.locator('[aria-pressed="true"]')).toHaveCount(1)
  await expect(choices.getByRole('button', { name: 'MD5', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(art).toHaveAttribute('data-form', 'MD5')
  await expect(art.locator('path').first()).toHaveAttribute('d', allotypeMarks(ALLOTYPES[0].value, 0)[0].d)
  await expect(art).toHaveAttribute('data-animated', 'true')
  await expect.poll(() => art.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBeGreaterThan(0)
  await home.getByRole('button', { name: '暂停动画', exact: true }).click()
  await expect(art).toHaveAttribute('data-animated', 'false')
  await expect.poll(() => art.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await home.getByRole('button', { name: '播放动画', exact: true }).click()
  await expect(art).toHaveAttribute('data-animated', 'true')
  await expect.poll(() => art.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBeGreaterThan(0)
  await expect(art).toHaveAttribute('data-form', 'MD5')
})

test('reduced motion: changing forms stays static even after pause and resume', async t => {
  const { page } = await session(t, { width: 390, height: 844, motion: 'reduce' })
  await visit(page, '/home')
  const home = page.getByTestId('allotype-home')
  const choices = home.getByRole('group', { name: '切换形态' })
  const art = home.locator('[data-form]')
  for (const seed of ALLOTYPES) {
    await choices.getByRole('button', { name: seed.name, exact: true }).click()
    await expect(art).toHaveAttribute('data-form', seed.name)
    await expect.poll(() => art.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  }
  await home.getByRole('button', { name: '暂停动画', exact: true }).click()
  await home.getByRole('button', { name: '播放动画', exact: true }).click()
  await expect(art).toHaveAttribute('data-animated', 'true')
  assert.equal(await art.evaluate(el => el.getAnimations({ subtree: true }).length), 0)
  const rect = await art.boundingBox()
  await page.mouse.move(rect.x + rect.width * .8, rect.y + rect.height * .3)
  assert.equal(await art.locator('[class*="print-plane"]').evaluate(el => getComputedStyle(el).translate), 'none')
})

for (const locale of ['en', 'ja', 'de']) {
  test(`320px localized typography: ${locale}`, async t => {
    const { page } = await session(t, { width: 320, height: 740, locale })
    await visit(page, '/home')
    await noOverflow(page)
    await shot(page, `home-320-${locale}`)
    const caption = await page.getByTestId('allotype-home').evaluate(home => {
      const title = home.querySelector('[aria-live="polite"] strong')
      const range = document.createRange()
      range.selectNodeContents(title)
      const text = range.getBoundingClientRect()
      const controls = home.querySelector('[class*="art-actions"]').getBoundingClientRect()
      return { text: text.toJSON(), controls: controls.toJSON() }
    })
    assert(caption.text.right <= caption.controls.left + 1 || caption.text.bottom <= caption.controls.top + 1,
      `Localized form name and number must not overlap motion controls: ${JSON.stringify(caption)}`)
    t.diagnostic(`Caption bounds: ${JSON.stringify(caption)}`)
  })
}

test('picker retains theme and dark mode after real reload; keyboard navigation works', async t => {
  const { page } = await session(t)
  await visit(page, '/home')
  await page.getByRole('link', { name: '外观', exact: true }).click()
  const themePage = page.getByTestId('theme-page')
  await expect(themePage).toBeVisible()
  await themePage.locator('label:has(input[value="dark"])').click()
  await themePage.locator('label:has(input[value="archive"])').click()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'archive')
  await themePage.locator('label:has(input[value="allotype"])').click()
  await themePage.getByRole('link', { name: '返回原页面', exact: true }).click()
  await expect(page).toHaveURL(`${baseURL}/home`)
  await expect(page.getByTestId('allotype-home')).toBeVisible()
  // Init-script defaults run on reload, so use a new page in the same context
  // without them to check the actual persisted preference.
  const stored = await page.evaluate(() => ({ design: localStorage.getItem('ark.design.v1'), mode: localStorage.getItem('ark.theme') }))
  assert.deepEqual(stored, { design: 'allotype', mode: 'dark' })
  const reloaded = await browser.newContext({ storageState: await page.context().storageState() })
  t.after(() => reloaded.close())
  const other = await reloaded.newPage()
  await visit(other, '/home')
  await expect(other.locator('html')).toHaveAttribute('data-design', 'allotype')
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.bringToFront()
  await page.getByRole('button', { name: /^MD5/ }).focus()
  await expect(page.getByRole('button', { name: /^MD5/ })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /^SHA-1/ })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-form]')).toHaveAttribute('data-form', 'SHA-1')
})

for (const width of [1440, 390]) {
  test(`shared page layouts: ${width}px`, async t => {
    const { page } = await session(t, { width, height: 900 })
    for (const path of ['/articles', '/moments', '/gallery', '/archive', '/about', '/lab', '/chat', '/terms', '/notice']) {
      await visit(page, path)
      await noOverflow(page)
      await shot(page, `${path.slice(1)}-${width}`)
    }
  })
}

for (const width of [390, 320]) {
  test(`mobile menu and account dialog: ${width}px`, async t => {
    const { page } = await session(t, { width, height: 740 })
    await visit(page, '/home')
    await page.locator('[data-menu-toggle]').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toBeVisible()
    await noOverflow(page)
    await shot(page, `menu-${width}`)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('[data-menu-toggle]')).toBeFocused()
    await visit(page, '/login')
    const accountDialog = page.getByRole('dialog', { name: '账号管理', exact: true })
    await expect(accountDialog).toBeVisible()
    await accountDialog.getByRole('button', { name: '注册', exact: true }).first().click()
    await page.locator('#email').fill('example@example.com')
    await noOverflow(page)
    await shot(page, `login-${width}`)
  })
}

for (const motion of ['no-preference', 'reduce']) {
  test(`connection commits destination and releases modal: ${motion}`, async t => {
    const { page } = await session(t, { width: 390, height: 844, motion, accounts: [account] })
    await visit(page, '/login?returnTo=%2Fabout')
    await shot(page, `identity-${motion}`)
    await page.getByRole('button', { name: '建立连接', exact: true }).click()
    await expect(page).toHaveURL(/\/about$/, { timeout: 20000 })
    await expect(page.getByTestId('allotype-connection')).toHaveCount(0)
    assert.equal(await page.locator('main').evaluate(el => el.closest('[inert]') !== null), false)
    await noOverflow(page)
  })
}

test('connection errors remain actionable; Escape restores login', async t => {
  const { page, context } = await session(t, { accounts: [account] })
  await context.route('**/api/auth/**', route => route.fulfill({ status: 503, json: { message: '测试连接暂时不可用' } }))
  await visit(page, '/login')
  await page.getByRole('button', { name: '建立连接', exact: true }).click()
  await expect(page.getByTestId('allotype-connection').getByRole('alert')).toHaveText('测试连接暂时不可用')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('allotype-connection')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '账号管理', exact: true })).toBeVisible()
})
