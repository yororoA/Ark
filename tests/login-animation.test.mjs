import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

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
  await page.waitForTimeout(2300);
  await checkTerminalLayout(page);
  await phase(page, 'success').waitFor();
  assert.match(await page.getByRole('status').textContent(), /身份认证通过/);
  assert.equal(await page.getByRole('dialog').getAttribute('aria-label'), 'BINES 连接终端');
  assert.doesNotMatch(await page.getByRole('dialog').textContent(), /PRTS/);
  assert.equal(await page.locator('[class*="welcome-role"]').textContent(), 'USER');
  await phase(page, 'sync').waitFor();
  await page.waitForURL('**/home');
  assert.ok(Date.now() - startedAt >= 12200, 'A fast response does not skip the reference timeline');
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
  await page.waitForTimeout(4900);
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
  await page.waitForTimeout(2400);
  await checkTerminalLayout(page);
  await shot(page, 'landscape-01-terminal');
  await page.goto(`${baseURL}/`);
  finish();
  await page.waitForTimeout(1500);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('img', { name: 'bg', exact: true }).evaluate((image) => image.classList.contains('brightness-60')), false);
});

async function networkPixels(buffer) {
  const metadata = await sharp(buffer).metadata();
  assert.ok(metadata.width && metadata.height);
  // Exclude the horizontal progress line at 66% and the footer below it.
  const { data, info } = await sharp(buffer).extract({
    left: 0,
    top: Math.floor(metadata.height * 0.34),
    width: metadata.width,
    height: Math.floor(metadata.height * 0.26),
  }).raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index] > 90 && data[index + 1] > 90 && data[index + 2] < data[index] * 0.8) count++;
  }
  return { count, data };
}

for (const [label, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  test(`${label} keyframes follow the reference and the network has visible moving pixels`, async (t) => {
    const { page } = await session(t, {
      viewport,
      respond: route => route.fulfill({ json: { ...account, isAdmin: true } }),
    });
    await page.getByRole('button', { name: '建立连接', exact: true }).click();
    const startedAt = Date.now();
    for (const [milliseconds, name] of [
      [1250, 'plaque'], [2200, 'expansion'], [3650, 'decoding'],
      [4650, 'seed'], [5400, 'sliced-title'], [6650, 'fields'], [8400, 'credentials'],
      [9350, 'scan'], [10600, 'welcome'],
    ]) {
      await page.waitForTimeout(Math.max(0, milliseconds - (Date.now() - startedAt)));
      await shot(page, `${label}-reference-${name}`);
    }
    assert.match(await page.getByRole('dialog').textContent(), /ADMINISTRATOR/);
    await phase(page, 'sync').waitFor();
    const network = page.getByTestId('connection-network');
    await page.locator('[data-testid="connection-network"][data-renderer="ready"]').waitFor();
    await page.waitForTimeout(170);
    const first = await networkPixels(await network.screenshot());
    await page.waitForTimeout(180);
    const second = await networkPixels(await network.screenshot());
    assert.ok(first.count > 300, 'The yellow wireframe is not blank');
    assert.ok(second.count > 300, 'The wireframe remains visible');
    assert.notDeepEqual(first.data, second.data, 'The wireframe rotates between frames');
    await shot(page, `${label}-reference-network`);
    await page.waitForURL('**/home');
  });
}

test('a narrow error screen does not overlap the terminal or lose keyboard focus', async (t) => {
  const { page } = await session(t, {
    viewport: { width: 320, height: 640 },
    respond: route => route.fulfill({ status: 401, json: { message: '测试会话已过期，请重新登录后再次建立连接。'.repeat(3) } }),
  });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'error').waitFor();
  const layout = await page.getByRole('dialog').evaluate(dialog => {
    const terminal = dialog.querySelector('[class*="terminal-content"]')?.getBoundingClientRect();
    const failure = dialog.querySelector('[class*="failure-detail"]')?.getBoundingClientRect();
    return { terminalBottom: terminal?.bottom, failureTop: failure?.top };
  });
  assert.ok(layout.terminalBottom <= layout.failureTop);
  assert.equal(await page.getByRole('button', { name: '返回登录' }).evaluate(button => button === document.activeElement), true);
  await shot(page, 'mobile-reference-error');
  await page.getByRole('button', { name: '返回登录' }).click();
  assert.equal(await page.getByRole('dialog', { name: 'BINES 连接终端' }).count(), 0);
});

async function checkControlBounds(page) {
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, input, [role="dialog"], [role="menu"]')).flatMap(element => {
      if (element.closest('[inert]') || getComputedStyle(element).visibility !== 'visible') return [];
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return rect.left < -1 || rect.right > innerWidth + 1
        ? [{ name: element.getAttribute('aria-label') || element.textContent?.slice(0, 40), left: rect.left, right: rect.right }]
        : [];
    })
  );
  assert.deepEqual(overflow, [], 'All usable controls stay within the screen width');
}

for (const viewport of [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`initial login and account controls fit ${viewport.width}x${viewport.height}`, async (t) => {
    const { page } = await session(t, {
      viewport,
      accounts: [account, { ...account, uid: 'second-fixture', username: 'Second fixture with a long display name' }],
    });
    await checkControlBounds(page);
    const entryGeometry = await page.evaluate(() => {
      const connect = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === '建立连接');
      const canvases = [...document.querySelectorAll('canvas')];
      const band = [...document.querySelectorAll('div')].find(element => getComputedStyle(element).backgroundColor === 'rgb(63, 63, 63)');
      const connectRect = connect?.getBoundingClientRect();
      const canvasRects = canvases.map(canvas => canvas.getBoundingClientRect());
      return {
        connect: connectRect && { width: connectRect.width, height: connectRect.height },
        canvas: canvasRects.map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })),
        band: band && { bottom: band.getBoundingClientRect().bottom, z: Number(getComputedStyle(band).zIndex) },
        sphereZ: canvases[0] ? Number(getComputedStyle(canvases[0].parentElement?.parentElement).zIndex) : null,
      };
    });
    assert.ok(entryGeometry.connect.width >= 176 && entryGeometry.connect.width <= 220);
    assert.ok(entryGeometry.connect.height >= 44 && entryGeometry.connect.height <= 56);
    for (const canvas of entryGeometry.canvas) {
      assert.ok(Math.abs(canvas.left + canvas.width / 2 - viewport.width / 2) < 1, 'Idle spheres stay horizontally centered');
      assert.ok(canvas.top < entryGeometry.band.bottom && canvas.top + canvas.height > entryGeometry.band.bottom, 'Top band overlaps part of the sphere');
    }
    assert.ok(entryGeometry.sphereZ < entryGeometry.band.z, 'Top band renders above the idle spheres');
    await shot(page, `entry-${viewport.width}x${viewport.height}`);
    await page.getByRole('button', { name: '账号管理', exact: true }).click();
    await checkControlBounds(page);
    await page.getByRole('button', { name: '选择账号' }).click();
    await page.getByRole('menu').waitFor();
    await checkControlBounds(page);
    await page.getByRole('menuitem').filter({ hasText: 'Second fixture' }).click();
    await page.getByRole('button', { name: '选择账号' }).click();
    await page.getByRole('button', { name: `删除 ${account.username} 的登录记录` }).click();
    await page.getByRole('button', { name: '取消', exact: true }).waitFor();
    await checkControlBounds(page);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('button', { name: '其他账号登录', exact: true }).click();
    await page.locator('#code').scrollIntoViewIfNeeded();
    await checkControlBounds(page);
    await shot(page, `register-${viewport.width}x${viewport.height}`);
    await page.getByRole('button', { name: '关闭账号管理', exact: true }).click();
    await page.getByRole('button', { name: '查看声明', exact: true }).click();
    await checkControlBounds(page);
    await shot(page, `declaration-${viewport.width}x${viewport.height}`);
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    await page.getByRole('button', { name: '建立连接', exact: true }).waitFor();
  });
}

test('first visit and a short keyboard-sized viewport keep registration reachable', async (t) => {
  const { page } = await session(t, { viewport: { width: 320, height: 480 }, accounts: [] });
  await checkControlBounds(page);
  await page.getByRole('button', { name: '其他账号登录', exact: true }).click();
  await page.locator('#code').scrollIntoViewIfNeeded();
  await checkControlBounds(page);
  await shot(page, 'first-visit-short-viewport');
  const registration = page.getByRole('button', { name: '注册', exact: true }).last();
  await registration.scrollIntoViewIfNeeded();
  assert.equal(await registration.isVisible(), true);
});

test('connection composition fills the viewport and Loading ends before synchronization', async (t) => {
  const { page } = await session(t, { viewport: { width: 960, height: 540 } });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'terminal').waitFor();
  await page.waitForTimeout(2800);
  const stage = await page.locator('[class*="terminal-stage"]').boundingBox();
  assert.deepEqual(stage, { x: 0, y: 0, width: 960, height: 540 });
  const layout = await page.locator('[class*="terminal-content"]').boundingBox();
  assert.ok(layout && layout.width > 800 && layout.width < 900);
  await shot(page, 'reference-960-terminal');
  await phase(page, 'success').waitFor();
  const loadingText = page.getByText('正在建立神经连接', { exact: true });
  await loadingText.waitFor();
  const loadingBounds = await loadingText.boundingBox();
  assert.ok(loadingBounds && loadingBounds.x >= 0 && loadingBounds.x + loadingBounds.width <= 960);
  await phase(page, 'sync').waitFor();
  assert.equal(await page.getByText('正在建立神经连接', { exact: true }).count(), 0);
  await page.waitForTimeout(350);
  await shot(page, 'reference-960-network');
  await page.waitForURL('**/home');
});

test('terminal details split smoothly into a trapezoid and type characters progressively', async (t) => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { page } = await session(t, {
    viewport: { width: 1280, height: 720 },
    respond: async route => {
      await pending;
      await route.fulfill({ json: account });
    },
  });
  await page.getByRole('button', { name: '建立连接', exact: true }).click();
  await phase(page, 'terminal').waitFor();
  const terminalStartedAt = Date.now();
  const corners = page.locator('[class*="terminal-content"] [class*="corner-marks"] > span');
  const positions = [];
  for (let index = 0; index < 6; index++) {
    await page.waitForTimeout(90);
    positions.push(await corners.first().evaluate(element => {
      const rect = element.getBoundingClientRect();
      return `${Math.round(rect.x)}:${Math.round(rect.y)}`;
    }));
  }
  assert.ok(new Set(positions).size >= 5, 'Corner splitting should have continuous intermediate positions');
  await page.waitForTimeout(220);
  const bounds = await corners.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  }));
  const topWidth = bounds[1].x - bounds[0].x;
  const bottomWidth = bounds[3].x - bounds[2].x;
  assert.ok(topWidth < bottomWidth, 'The four corners must form a top-narrow trapezoid');
  const fragments = page.locator('[class*="brand-slice"]');
  assert.equal(await fragments.count(), 7);
  const fragmentDurations = await fragments.evaluateAll(elements =>
    elements.map(element => element.getAnimations()[0]?.effect.getTiming().duration)
  );
  assert.deepEqual(fragmentDurations, Array(7).fill(650), 'Fragment motion is accelerated without changing the terminal phase');

  const firstField = page.locator('[class*="field-box"]').first();
  await page.waitForTimeout(260);
  const fieldPositions = [];
  for (let index = 0; index < 6; index++) {
    fieldPositions.push(Math.round((await firstField.boundingBox()).x));
    await page.waitForTimeout(70);
  }
  assert.ok(new Set(fieldPositions).size >= 4, 'The input frame should move through multiple smooth positions');
  await page.waitForTimeout(Math.max(0, 2300 - (Date.now() - terminalStartedAt)));
  const characters = page.locator('[class*="field-value"] [class*="typed-character"]');
  const earlyVisible = await characters.evaluateAll(elements => elements.filter(element => Number(getComputedStyle(element).opacity) > .5).length);
  await page.waitForTimeout(360);
  const laterVisible = await characters.evaluateAll(elements => elements.filter(element => Number(getComputedStyle(element).opacity) > .5).length);
  assert.ok(laterVisible > earlyVisible, 'Username characters should appear progressively');
  finish();
});
