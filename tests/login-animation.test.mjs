import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:9999';
const screenshotDirectory = join(process.cwd(), 'test-results', 'login-animation');
const account = { uid: 'animation-fixture', username: 'Test Doctor', lastLoginAt: '2026-01-01T00:00:00.000Z' };
let browser;

before(async () => {
  await mkdir(screenshotDirectory, { recursive: true });
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function session(t, { viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference', accounts = [account], respond } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  t.after(() => context.close());
  // Isolated synthetic identity; all auth requests are intercepted before leaving the browser.
  await context.addInitScript((details) => {
    localStorage.setItem('authDetails', JSON.stringify(details));
  }, accounts);
  const requests = [];
  await context.route('**/api/auth/**', async (route) => {
    const request = route.request();
    requests.push({ action: request.url().split('/').at(-1), body: request.postDataJSON() });
    if (respond) return respond(route, requests.length);
    await route.fulfill({ json: { ...account, isGuest: false, isAdmin: false } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/login`);
  await page.getByRole('button', { name: accounts.length ? '建立连接' : '其他账号登录', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'));
  return { page, requests };
}

function phase(page, name) {
  return page.locator(`[data-testid="connection-sequence"][data-phase="${name}"]`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(screenshotDirectory, `${name}.png`) });
}

async function checkTerminalLayout(page) {
  const overflow = await page.getByRole('dialog').evaluate((dialog) => {
    const nodes = Array.from(dialog.querySelectorAll('h1, [role="status"], [class*="identity-panel"], [class*="field-value"], footer'));
    return nodes.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1
        ? [element.className || element.tagName] : [];
    });
  });
  assert.deepEqual(overflow, [], 'Terminal text and controls stay within the viewport');
}

test('fast authentication still plays the full sequence and ignores duplicate clicks', async (t) => {
  const { page, requests } = await session(t);
  const startedAt = Date.now();
  await page.getByRole('button', { name: '建立连接', exact: true }).dblclick({ delay: 0 });
  await phase(page, 'boot').waitFor();
  await phase(page, 'terminal').waitFor();
  await checkTerminalLayout(page);
  await phase(page, 'success').waitFor();
  assert.match(await page.getByRole('status').textContent(), /身份认证通过/);
  await page.waitForURL('**/home');
  assert.ok(Date.now() - startedAt >= 4500, 'A fast response does not skip the introduction');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { action: 'switch', body: { uid: account.uid } });
  assert.equal(await page.getByRole('img', { name: 'bg', exact: true }).evaluate((image) => image.classList.contains('brightness-60')), false);
});

test('slow authentication waits on mobile instead of inventing success', async (t) => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { page } = await session(t, {
    viewport: { width: 390, height: 844 },
    accounts: [{ ...account, username: 'A-very-long-doctor-name-that-must-not-overflow-the-terminal' }],
    respond: async (route) => {
      await pending;
      await route.fulfill({ json: account });
    },
  });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'boot').waitFor();
  await page.waitForTimeout(900);
  await shot(page, 'mobile-01-boot');
  await phase(page, 'terminal').waitFor();
  await page.waitForTimeout(3300);
  assert.match(page.url(), /\/login$/);
  assert.equal(await page.getByRole('dialog').getAttribute('aria-busy'), 'true');
  assert.match(await page.getByRole('status').textContent(), /正在进行身份认证/);
  await checkTerminalLayout(page);
  await shot(page, 'mobile-02-waiting');
  finish();
  await page.waitForURL('**/home');
});

test('failure shows the backend message and can start a fresh connection', async (t) => {
  const { page, requests } = await session(t, {
    respond: (route, attempt) => route.fulfill(attempt === 1
      ? { status: 401, json: { message: '测试会话已过期，请重新登录' } }
      : { json: account }),
  });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'error').waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('alert').textContent(), '测试会话已过期，请重新登录');
  await page.waitForTimeout(800);
  await shot(page, 'desktop-04-error');
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await phase(page, 'boot').waitFor();
  await page.waitForURL('**/home');
  assert.equal(requests.length, 2);
});

test('reduced motion has no active animations and does not bypass pending authentication', async (t) => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { page } = await session(t, {
    viewport: { width: 320, height: 640 },
    reducedMotion: 'reduce',
    respond: async (route) => {
      await pending;
      await route.fulfill({ json: account });
    },
  });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'terminal').waitFor();
  await checkTerminalLayout(page);
  assert.equal(await page.getByRole('dialog').evaluate((dialog) => dialog.getAnimations({ subtree: true }).length), 0);
  await shot(page, 'mobile-03-reduced-motion');
  finish();
  await page.waitForURL('**/home', { timeout: 2000 });
});

for (const action of ['login', 'register']) {
  test(`first-time ${action} preserves the existing auth payload`, async (t) => {
    const { page, requests } = await session(t, { accounts: [], reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '其他账号登录', exact: true }).click();
    if (action === 'login') {
      await page.getByRole('button', { name: '登录', exact: true }).first().click();
    }
    await page.locator('#username').fill('fixture-user');
    await page.locator('#password').fill('synthetic-test-only');
    if (action === 'register') {
      await page.locator('#email').fill('fixture@example.invalid');
      await page.locator('#code').fill('123456');
    }
    await page.getByRole('button', { name: action === 'login' ? '登录' : '注册', exact: true }).last().click();
    await page.waitForURL('**/home');
    assert.deepEqual(requests, [{
      action,
      body: action === 'login'
        ? { username: 'fixture-user', password: 'synthetic-test-only' }
        : { username: 'fixture-user', password: 'synthetic-test-only', email: 'fixture@example.invalid', verificationCode: '123456' },
    }]);
  });
}

test('a malformed successful response never reaches the home page', async (t) => {
  const { page } = await session(t, {
    accounts: [],
    reducedMotion: 'reduce',
    respond: (route) => route.fulfill({ json: {} }),
  });
  await page.getByRole('button', { name: '其他账号登录', exact: true }).click();
  await page.getByRole('button', { name: '登录', exact: true }).first().click();
  await page.locator('#username').fill('fixture-user');
  await page.locator('#password').fill('synthetic-test-only');
  await page.getByRole('button', { name: '登录', exact: true }).last().click();
  await phase(page, 'error').waitFor();
  assert.match(page.url(), /\/login$/);
  assert.match(await page.getByRole('dialog').getByRole('alert').textContent(), /登录失败/);
});

test('landscape terminal remains readable and a late response cannot navigate an abandoned login', async (t) => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { page } = await session(t, {
    viewport: { width: 844, height: 390 },
    respond: async (route) => {
      await pending;
      await route.fulfill({ json: account });
    },
  });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'terminal').waitFor();
  await page.waitForTimeout(1600);
  await checkTerminalLayout(page);
  await shot(page, 'landscape-01-terminal');
  await page.goto(`${baseURL}/`);
  finish();
  await page.waitForTimeout(1500);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('img', { name: 'bg', exact: true }).evaluate((image) => image.classList.contains('brightness-60')), false);
});
