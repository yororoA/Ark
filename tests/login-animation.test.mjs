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

test('reduced motion preference does not suppress the connection animation', async (t) => {
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
  await phase(page, 'boot').waitFor();
  await page.waitForTimeout(150);
  assert.ok(
    await page.getByRole('dialog').evaluate((dialog) => dialog.getAnimations({ subtree: true }).length) > 0,
    'Animations remain active when the operating system requests reduced motion',
  );
  finish();
  await phase(page, 'terminal').waitFor({ timeout: 5000 });
  await checkTerminalLayout(page);
  await shot(page, 'mobile-03-reduced-motion');
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
  // Sample the enlarged sphere above the horizontal progress line at 66%.
  const { data, info } = await sharp(buffer).extract({
    left: 0,
    top: Math.floor(metadata.height * 0.2),
    width: metadata.width,
    height: Math.floor(metadata.height * 0.42),
  }).raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  let minX = info.width;
  let maxX = -1;
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index] > 40 && data[index + 1] > 40 && data[index + 2] < data[index] * 0.8) {
      const x = Math.floor(index / info.channels) % info.width;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  return { count, data, width: info.width, minX, maxX };
}

async function canvasBuffer(page, locator) {
  const box = await locator.boundingBox();
  assert.ok(box);
  return page.screenshot({ clip: box, animations: 'allow' });
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
      [1250, 'plaque'], [1900, 'rim-draw'], [2200, 'expansion'], [3650, 'decoding'],
      [4650, 'seed'], [5400, 'sliced-title'], [6650, 'fields'], [8400, 'credentials'],
      [9350, 'scan'], [10600, 'welcome'],
    ]) {
      await page.waitForTimeout(Math.max(0, milliseconds - (Date.now() - startedAt)));
      await shot(page, `${label}-reference-${name}`);
      if (name === 'plaque') {
        const projection = await page.locator('[class*="boot-projection"]').evaluate(
          element => ({
            filter: getComputedStyle(element).filter,
            opacity: Number.parseFloat(getComputedStyle(element).opacity),
          }),
        );
        assert.match(projection.filter, /blur\(/, 'The full opening layer keeps a blurred projected copy');
        assert.ok(projection.opacity > 0 && projection.opacity < .6, 'The projected copy stays subordinate to the sharp plane');
      }
      if (name === 'rim-draw') {
        const mark = await page.evaluate(() => {
          const plane = document.querySelector('[class*="boot-plane"]:not([class*="boot-projection"])');
          const text = plane?.querySelector('[class*="boot-plaque"] strong')?.getBoundingClientRect();
          const underline = plane?.querySelector('[class*="plaque-crossline"]')?.getBoundingClientRect();
          const rim = plane?.querySelector('[class*="plaque-rim"]');
          return {
            textBottom: text?.bottom,
            underlineTop: underline?.top,
            rimSweep: Number.parseFloat(getComputedStyle(rim).getPropertyValue('--rim-sweep')),
          };
        });
        assert.ok(mark.underlineTop >= mark.textBottom, 'The plaque line stays below BINES');
        assert.ok(mark.rimSweep > 0 && mark.rimSweep < 360, 'The yellow diamond is drawn progressively');
      }
      if (name === 'expansion') {
        const plaqueBackground = await page
          .locator('[class*="boot-plane"]:not([class*="boot-projection"]) [class*="boot-plaque"]')
          .evaluate(element => getComputedStyle(element).backgroundColor);
        assert.match(plaqueBackground, /^rgba\(/, 'The yellow diamond keeps a translucent center');
      }
      if (name === 'decoding') {
        const rail = await page.evaluate(() => {
          const plane = document.querySelector('[class*="boot-plane"]:not([class*="boot-projection"])');
          const visibleCells = (selector) => Array.from(
            plane?.querySelectorAll(`${selector} > i`) ?? [],
          ).filter(element => Number.parseFloat(getComputedStyle(element).opacity) > .5).length;
          const decodeTrack = plane?.querySelector('[class*="decode-track"]');
          return {
            matrix: plane?.querySelector('[class*="letter-matrix"]')?.textContent,
            decodeText: decodeTrack?.lastElementChild?.textContent,
            decodeOffset: new DOMMatrixReadOnly(getComputedStyle(decodeTrack).transform).f,
            slashCount: plane?.querySelectorAll('[class*="rail-ticks"] > i').length,
            visibleSlashes: visibleCells('[class*="rail-ticks"]'),
            squareCount: plane?.querySelectorAll('[class*="rail-upper-nodes"] > i').length,
            visibleSquares: visibleCells('[class*="rail-upper-nodes"]'),
            slashTransform: getComputedStyle(plane?.querySelector('[class*="rail-ticks"]')).transform,
            squareTransform: getComputedStyle(plane?.querySelector('[class*="rail-upper-nodes"]')).transform,
          };
        });
        assert.equal(rail.matrix, 'YOROROICE');
        assert.equal(rail.decodeText, 'BINES NETWORK');
        assert.ok(rail.decodeOffset <= -109, 'The decoder settles on the BINES NETWORK row');
        assert.equal(rail.visibleSlashes, rail.slashCount, 'The left slash loader completes before the square loader');
        assert.ok(rail.visibleSquares > 0 && rail.visibleSquares < rail.squareCount, 'The right square loader advances one complete cell at a time');
        assert.equal(rail.slashTransform, 'none', 'The left cells are never stretched');
        assert.equal(rail.squareTransform, 'none', 'The right cells are never stretched');
        if (label === 'desktop') {
          const plaque = await page
            .locator('[class*="boot-plane"]:not([class*="boot-projection"]) [class*="boot-plaque"]')
            .boundingBox();
          assert.ok(plaque && plaque.width / viewport.width >= .16, 'The opening plaque scales up on desktop');
        }
      }
      if (label === 'desktop' && name === 'fields') {
        const content = await page.locator('[class*="terminal-content"]').boundingBox();
        assert.ok(
          content && content.width / viewport.width >= .75,
          'The terminal composition uses most of a desktop viewport',
        );
      }
      if (label === 'desktop' && name === 'welcome') {
        const confirmation = await page.locator('[class*="identity-confirmation"]').boundingBox();
        assert.ok(
          confirmation && confirmation.width / viewport.width >= .5,
          'The identity confirmation does not collapse into excess whitespace',
        );
      }
    }
    assert.match(await page.getByRole('dialog').textContent(), /ADMINISTRATOR/);
    const network = page.getByTestId('connection-network');
    await page.locator('[data-testid="connection-network"][data-renderer="ready"]').waitFor({ state: 'attached' });
    await phase(page, 'sync').waitFor();
    const firstPhase = await page.getByRole('dialog').getAttribute('data-phase');
    const firstStageScale = await page.locator('[class*="network-stage"]').evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return Math.hypot(matrix.a, matrix.b);
    });
    const first = await networkPixels(await canvasBuffer(page, network));
    await page.waitForTimeout(80);
    const secondPhase = await page.getByRole('dialog').getAttribute('data-phase');
    const second = await networkPixels(await canvasBuffer(page, network));
    const progress = page.getByTestId('connection-progress');
    const initialProgressState = await progress.evaluate(element => ({
      phase: element.closest('[data-phase]')?.getAttribute('data-phase'),
      value: Number(element.getAttribute('data-progress')),
    }));
    if (initialProgressState.phase === 'sync') {
      assert.ok(initialProgressState.value >= 0 && initialProgressState.value <= 80);
      assert.equal(await progress.locator('i').count(), 2, 'Both progress fronts display the percentage');
    } else {
      assert.equal(initialProgressState.phase, 'exit');
      assert.equal(initialProgressState.value, 100);
    }
    assert.equal(
      await progress.locator('span').first().evaluate(element => getComputedStyle(element).backgroundColor),
      'rgb(236, 232, 115)',
      'The restored progress keeps the current yellow color',
    );
    await shot(page, `${label}-reference-network`);
    assert.ok(first.count > 100, 'The yellow wireframe is not blank');
    assert.notDeepEqual(first.data, second.data, 'The wireframe rotates between frames');
    if (firstPhase === 'sync' && secondPhase === 'sync') {
      assert.ok(second.count > 500, 'The wireframe remains visible during synchronization');
    } else {
      assert.equal(secondPhase, 'exit');
      assert.ok(second.count < first.count, 'The wireframe fades during exit');
    }
    if (label === 'desktop' && firstPhase === 'sync') {
      const networkWidth = Math.round((first.maxX - first.minX + 1) / firstStageScale);
      const networkWidthRatio = networkWidth / first.width;
      assert.ok(
        networkWidth >= 430 && networkWidth <= 520,
        `The wireframe restores the historical desktop footprint (received ${networkWidth}px)`,
      );
      assert.ok(networkWidthRatio >= .28 && networkWidthRatio <= .38, 'The wireframe keeps the historical bounded scale');
    }
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
    assert.ok(entryGeometry.connect.width >= 176 && entryGeometry.connect.width <= Math.min(300, viewport.width - 32));
    assert.ok(entryGeometry.connect.height >= 56 && entryGeometry.connect.height <= 90);
    if (viewport.height >= 800) {
      assert.ok(entryGeometry.connect.height > 56, 'The primary button scales with the viewport height');
    }
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
  await page.evaluate(() => {
    Math.random = () => .99;
  });
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
  const progressSamples = await page.evaluate(() => new Promise((resolve, reject) => {
    const deadline = performance.now() + 3000;
    const waitForSync = (now) => {
      const dialog = document.querySelector('[data-testid="connection-sequence"]');
      if (dialog?.getAttribute('data-phase') !== 'sync') {
        if (now >= deadline) {
          reject(new Error('Synchronization did not start'));
          return;
        }
        requestAnimationFrame(waitForSync);
        return;
      }

      const startedAt = now;
      const samples = [];
      const collect = (timestamp) => {
        const progress = dialog.querySelector('[data-testid="connection-progress"]');
        samples.push({
          value: Number(progress?.getAttribute('data-progress')),
          labels: progress?.querySelectorAll('i').length,
          color: progress?.firstElementChild
            ? getComputedStyle(progress.firstElementChild).backgroundColor
            : '',
        });
        if (timestamp - startedAt >= 400) {
          resolve(samples);
          return;
        }
        requestAnimationFrame(collect);
      };
      collect(now);
    };
    requestAnimationFrame(waitForSync);
  }));
  assert.equal(await page.getByText('正在建立神经连接', { exact: true }).count(), 0);
  assert.ok(progressSamples.length > 10);
  assert.ok(progressSamples[0].value >= 0 && progressSamples[0].value <= 80);
  assert.ok(progressSamples.at(-1).value >= progressSamples[0].value + 24);
  assert.ok(progressSamples.every(sample => sample.value <= 80 && sample.labels === 2));
  assert.equal(progressSamples[0].color, 'rgb(236, 232, 115)');
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
  const bootTransform = await page.locator('[class*="boot-plane"]:not([class*="boot-projection"])').evaluate(element => getComputedStyle(element).transform);
  assert.match(bootTransform, /^matrix3d\(/, 'The opening rail and details share a 3D perspective plane');
  await phase(page, 'terminal').waitFor();
  const terminalStartedAt = Date.now();
  const terminalTransform = await page.locator('[class*="terminal-content"]').evaluate(element => getComputedStyle(element).transform);
  assert.match(terminalTransform, /^matrix3d\(/, 'The terminal content is projected as a 3D plane');
  const corners = page.locator('[class*="terminal-content"] [class*="corner-marks"] > span');
  const positions = [];
  await page.waitForTimeout(250);
  for (let index = 0; index < 6; index++) {
    await page.waitForTimeout(75);
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
  assert.ok(topWidth / bottomWidth >= .88 && topWidth / bottomWidth <= .97, 'The trapezoid perspective should stay close to the reference');
  const fragments = page.locator('[class*="brand-slice"]');
  assert.equal(await fragments.count(), 7);
  const fragmentDurations = await fragments.evaluateAll(elements =>
    elements.map(element => element.getAnimations()[0]?.effect.getTiming().duration)
  );
  assert.deepEqual(fragmentDurations, Array(7).fill(520), 'Fragment motion is accelerated without changing the terminal phase');

  const firstField = page.locator('[class*="field-box"]').first();
  await page.waitForTimeout(Math.max(0, 1480 - (Date.now() - terminalStartedAt)));
  const fieldPositions = [];
  for (let index = 0; index < 6; index++) {
    fieldPositions.push(Math.round((await firstField.boundingBox()).x));
    await page.waitForTimeout(70);
  }
  assert.ok(new Set(fieldPositions).size >= 4, 'The input frame should move through multiple smooth positions');
  await page.waitForTimeout(Math.max(0, 2450 - (Date.now() - terminalStartedAt)));
  const characters = page.locator('[class*="field-value"] [class*="typed-character"]');
  const earlyVisible = await characters.evaluateAll(elements => elements.filter(element => Number(getComputedStyle(element).opacity) > .5).length);
  await page.waitForTimeout(360);
  const laterVisible = await characters.evaluateAll(elements => elements.filter(element => Number(getComputedStyle(element).opacity) > .5).length);
  assert.ok(laterVisible > earlyVisible, 'Username characters should appear progressively');
  finish();
});
