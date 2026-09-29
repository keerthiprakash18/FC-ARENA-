import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const android = process.env.ANDROID_SMOKE === '1';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-smoke';
mkdirSync(output, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' }).trim();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const user = { id: 'smoke', fullName: 'Android Scroll Validation Long Player Name', email: 'smoke@example.invalid', role: 'PLAYER', status: 'ACTIVE', themePreference: 'CLASSIC_BLUE', player: { playerCode: 'TEST01', profileImageUrl: null, identity: { inGameName: 'LongAndroidPlayerNameForLayoutValidation', gameUid: '123', isVerified: true } } };
const career = { profile: { ...user.player, primaryLeague: null, secondaryLeague: null }, lifetimeStatistics: { matches: 20, wins: 10, draws: 5, losses: 5, goalsFor: 40, goalsAgainst: 20, goalDifference: 20, winRate: 50, form: ['W','D','L'], tournaments: 2, achievements: 0 }, matchHistory: [], tournamentHistory: [], leagueHistory: [], achievements: [] };
const errors = [];
const results = [];
let browser;
async function connect() {
  if (!android) return chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const pid = adb('shell', 'pidof', 'in.fcarena.app.debug');
      assert(pid);
      adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
      return await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 2000 });
    } catch { await pause(1000); }
  }
  throw new Error('WebView debugging endpoint never became available');
}
async function prepare(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  // All app content comes from this checkout. All API calls are fixtures;
  // never log into or mutate production. URL origin remains the real HTTPS
  // origin so Android allowlisting and same-origin SPA links are exercised.
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      let data;
      switch (url.pathname) {
        case '/api/auth/refresh': data = { accessToken: 'smoke-only', expiresIn: 3600 }; break;
        case '/api/auth/me': data = { user }; break;
        case '/api/players/me/career': data = career; break;
        case '/api/leagues/my': data = { leagues: [] }; break;
        case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
        default: errors.push(`Unmocked API: ${url.pathname}`); return route.abort();
      }
      return route.fulfill({ json: { success: true, data, error: null }, headers: { 'access-control-allow-origin': 'https://fcarena.in', 'access-control-allow-credentials': 'true' } });
    }
    if (url.hostname === 'fcarena.in') {
      try {
        const response = await fetch(`http://127.0.0.1:3000${url.pathname}${url.search}`, { headers: { ...route.request().headers(), host: 'localhost:3000' } });
        const headers = Object.fromEntries(response.headers);
        delete headers['content-encoding']; delete headers['transfer-encoding']; delete headers['content-length'];
        return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
      } catch (error) { errors.push(String(error)); return route.abort(); }
    }
    errors.push(`Unexpected network request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
}
async function metrics(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    };
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.65);
    return { height: innerHeight, width: innerWidth, scrollHeight: document.documentElement.scrollHeight, scrollY, scrollWidth: document.documentElement.scrollWidth, native: document.documentElement.dataset.nativeApp, header: rect('.theme-top-header'), nav: rect('.theme-bottom-nav'), hit: hit?.tagName + '.' + hit?.className, shellOverflow: getComputedStyle(document.querySelector('.fc-app-shell')).overflowY };
  });
}
async function swipe(page, upwards) {
  if (android) {
    const size = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/);
    const x = Math.round(Number(size[1]) * 0.5);
    const low = Math.round(Number(size[2]) * 0.70), high = Math.round(Number(size[2]) * 0.30);
    adb('shell', 'input', 'swipe', String(x), String(upwards ? low : high), String(x), String(upwards ? high : low), '500');
  } else {
    const session = await page.context().newCDPSession(page);
    const { width, height } = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const x = width / 2, start = height * (upwards ? 0.7 : 0.3), end = height * (upwards ? 0.3 : 0.7);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
    for (let i = 1; i <= 12; i++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start + (end - start) * i / 12 }] });
      await pause(30);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  }
  await pause(800);
}
async function checkScroll(page, name, required = false) {
  const before = await metrics(page);
  assert.equal(before.native, 'android', 'native stylesheet marker missing');
  assert(before.scrollWidth <= before.width + 1, `${name}: horizontal overflow`);
  assert.equal(before.shellOverflow, 'visible', `${name}: shell creates nested scroll container`);
  if (required) assert(before.scrollHeight > before.height + 100, `${name}: dashboard did not render scrollable content`);
  if (before.scrollHeight > before.height + 100) {
    await swipe(page, true);
    const after = await metrics(page);
    assert(after.scrollY > before.scrollY + 10, `${name}: REAL SWIPE DID NOT SCROLL ${JSON.stringify({before,after})}`);
    assert(Math.abs(after.header.top - before.header.top) < 2, `${name}: header moved`);
    if (before.nav) {
      assert(after.nav, `${name}: navigation disappeared`);
      assert(Math.abs(after.nav.top - before.nav.top) < 2, `${name}: navigation moved`);
    }
    await swipe(page, false);
    const back = await metrics(page);
    assert(back.scrollY < after.scrollY - 10, `${name}: downward swipe stuck`);
    results.push({ name, before, after, back });
  } else results.push({ name, before, note: 'Content fits viewport; no scroll expected' });
  console.log(`PASS ${name}`);
}
try {
  browser = await connect();
  const widths = android ? [null] : [360,375,390,412,430,768];
  for (const width of widths) {
    const context = android ? browser.contexts()[0] : await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36 FC-Arena-Android/1.0.6-debug' });
    const page = android ? context.pages()[0] : await context.newPage();
    await prepare(page);
    await page.goto('https://fcarena.in/dashboard');
    await page.locator('.fc-dashboard-hero').waitFor();
    await checkScroll(page, `dashboard-${width || 'emulator'}`, true);
    await page.screenshot({ path: `${output}/dashboard-${width || 'emulator'}.png` });
    await page.evaluate(() => { window.__smokeDocument = 'same-document'; });
    for (const path of ['/leagues','/tournaments','/fixtures','/more','/dashboard']) {
      await page.locator(`.theme-bottom-nav a[href="${path}"]`).click();
      await page.waitForURL(`**${path}`);
      await page.locator('.fc-main').waitFor();
      assert.equal(await page.evaluate(() => window.__smokeDocument), 'same-document', 'SPA tab caused full document reload');
      await checkScroll(page, `${path}-${width || 'emulator'}`);
    }
    for (const path of ['/profile','/career']) {
      await page.goto(`https://fcarena.in${path}`);
      await page.locator('.fc-main').waitFor();
      await checkScroll(page, `${path}-${width || 'emulator'}`);
    }
    if (android) {
      adb('shell', 'input', 'keyevent', '4');
      await page.waitForURL('**/profile');
      for (let cycle = 1; cycle <= 5; cycle++) {
        adb('shell', 'input', 'keyevent', '3');
        adb('shell', 'am', 'start', '-W', '-n', 'in.fcarena.app.debug/in.fcarena.app.MainActivity');
        await page.locator('.fc-main').waitFor();
        assert(adb('shell','pidof','in.fcarena.app.debug'), `resume cycle ${cycle} crashed`);
      }
    } else await context.close();
  }
  assert.deepEqual(errors, [], 'Runtime/network errors');
  writeFileSync(`${output}/results.json`, JSON.stringify({ mode: android ? 'real adb swipe' : 'Chromium touch', results, errors }, null, 2));
  console.log(`PASS: ${results.length} page/viewport checks; ${android ? 'real adb swipe, back and 5 resumes' : '6 viewport profiles'}`);
} catch (error) {
  writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), results, errors }, null, 2));
  throw error;
} finally { await browser?.close(); }
