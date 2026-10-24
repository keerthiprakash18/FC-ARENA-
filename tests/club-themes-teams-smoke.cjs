// Run after NEXT_PUBLIC_API_URL=https://api.fcarena.in/api npm run build:web.
// Uses the existing Android smoke-test Playwright
// installation. All API traffic is mocked; no production data is read or written.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const { chromium } = createRequire(path.join(root, 'apps/android/tests/package.json'))('playwright');
const origin = 'http://127.0.0.1:3198';
const server = spawn(process.execPath, [webRequire.resolve('next/dist/bin/next'), 'start', '--port', '3198', '--hostname', '127.0.0.1'], { cwd: path.join(root, 'apps/web'), stdio: 'ignore' });
let browser;
  const errors = [];
const themes = [
  ['Luxury Gold', 'LUXURY_GOLD', 'luxury-gold'], ['Classic Blue', 'CLASSIC_BLUE', 'classic-blue'],
  ['Manchester City', 'CITY_SKY', 'city-sky'], ['Arsenal', 'LONDON_RED', 'london-red'],
  ['Liverpool', 'MERSEY_RED', 'mersey-red'], ['Real Madrid', 'MADRID_ROYAL', 'madrid-royal'],
  ['Barcelona', 'CATALAN_NIGHTS', 'catalan-nights'], ['Bayern Munich', 'MUNICH_RED', 'munich-red'],
  ['Paris Saint-Germain', 'PARIS_NIGHT', 'paris-night'], ['Inter Milan', 'MILAN_BLUE', 'milan-blue'],
  ['AC Milan', 'MILAN_RED', 'milan-red'], ['Juventus', 'TURIN_MONO', 'turin-mono'],
];

async function run() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Local Next.js test server exited');
    if (await fetch(origin).then(r => r.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
  let savedTheme = 'CLASSIC_BLUE';
  let failThemeSave = false;
  let createCalls = 0;
  let bulkCalls = 0;
  const contrastFailures = [];
  const entries = [{ id: 'city', entryName: 'Manchester City', status: 'APPROVED', fixtureCount: 0, sortOrder: 0 }];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.startsWith('/api/')) {
      let data;
      const failure = message => route.fulfill({ status: 409, headers: cors, json: { success: false, data: null, error: { code: 'ENTRY_NAME_ALREADY_EXISTS', message } } });
      switch (url.pathname) {
        case '/api/auth/refresh': data = { accessToken: 'local-test-only', expiresIn: 3600 }; break;
        case '/api/auth/me': data = { user: { id: 'user', fullName: 'Test Player', role: 'PLAYER', status: 'ACTIVE', themePreference: savedTheme, player: { playerCode: 'TEST01', identity: { inGameName: 'Test Player', isVerified: true } } } }; break;
        case '/api/auth/preferences/theme':
          if (failThemeSave) return failure('Theme could not be saved. Please retry.');
          savedTheme = route.request().postDataJSON().themePreference;
          data = { themePreference: savedTheme }; break;
        case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
        case '/api/telemetry/web-vitals': data = { accepted: true }; break;
        case '/api/tournaments/cup': data = { tournament: { id: 'cup', name: 'Test UCL', leagueId: 'league', mode: 'SOLO', teamSize: 1, status: 'REGISTRATION_OPEN', registrationMode: 'OPEN', maxEntries: 32, approvedEntries: 1, isLeagueAdmin: true } }; break;
        case '/api/tournaments/cup/wizard': data = { currentStep: 'TEAMS', steps: ['SETUP', 'TEAMS', 'GROUPS'] }; break;
        case '/api/tournaments/cup/entries':
          if (method === 'POST') { createCalls++; entries.push({ id: 'new', entryName: route.request().postDataJSON().entryName, status: 'APPROVED', fixtureCount: 0, sortOrder: 1 }); }
          data = { entries }; break;
        case '/api/tournaments/cup/entries/bulk': bulkCalls++; data = {}; break;
        case '/api/tournaments/cup/my-registration': data = { registration: null }; break;
        case '/api/tournaments/cup/registrations': data = { registrations: [] }; break;
        case '/api/tournaments/cup/register': return failure('“Manchester City” already exists in this Tournament. Choose a different team name.');
        default: errors.push(`Unmocked API ${url.pathname}`); return route.abort();
      }
      return route.fulfill({ headers: cors, json: { success: true, data, error: null } });
    }
    if (url.origin === origin) return route.continue();
    errors.push(`Unexpected external request ${url.origin}${url.pathname}`);
    return route.abort();
  });

  await page.goto(`${origin}/tournaments/cup/wizard/teams`);
  const pickerButton = page.getByRole('button', { name: 'Choose club theme', exact: true });
  await pickerButton.waitFor().catch(async error => {
    console.error({ url: page.url(), errors, screen: (await page.locator('body').innerText()).slice(0, 1500) });
    throw error;
  });
  for (const width of [360, 390, 412, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const mode of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: mode === 'dark' ? 'Switch to Dark Mode' : 'Switch to Light Mode' });
      if (await toggle.count()) await toggle.click();
      for (const [label, preference, dataTheme] of themes) {
        await pickerButton.click();
        const dialog = page.getByRole('dialog', { name: 'Choose FC Arena club theme' });
        await dialog.waitFor();
        const box = await dialog.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 801, 'Picker must fit viewport');
        await dialog.getByRole('button', { name: label, exact: false }).click();
        await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, dataTheme);
        await dialog.waitFor({ state: 'detached' });
        assert.equal(savedTheme, preference);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), mode);
        if (width === 1280) {
          const failures = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            const luminance = name => {
              const hex = style.getPropertyValue(name).trim().replace('#', '');
              const rgb = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
                .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
              return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
            };
            return [['--theme-text', '--theme-surface'], ['--theme-text-muted', '--theme-surface'], ['--theme-primary', '--theme-surface'], ['--theme-on-primary', '--theme-primary']].flatMap(([fg, bg]) => {
              const a = luminance(fg), b = luminance(bg);
              const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              return ratio < 4.5 ? [`${fg}/${bg}: ${ratio.toFixed(2)}`] : [];
            });
          });
          contrastFailures.push(...failures.map(failure => `${label} ${mode}: ${failure}`));
          if (preference !== 'LUXURY_GOLD') {
            assert.match(await page.locator('.theme-sidebar').evaluate(node => getComputedStyle(node).backgroundImage), /gradient/, 'Club sidebar should retain its gradient');
          }
        }
      }
    }
  }
  await page.reload();
  await pickerButton.waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'turin-mono');
  await pickerButton.click();
  await page.keyboard.press('Escape');
  assert.equal(await pickerButton.evaluate(node => document.activeElement === node), true, 'Escape restores trigger focus');
  failThemeSave = true;
  await pickerButton.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Arsenal' }).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'turin-mono', 'Failed save restores previous theme');
  await page.getByRole('button', { name: 'Close club theme picker' }).click();

  await page.getByText('Admin Manual Entry — Optional').click();
  await page.getByLabel('Team Name', { exact: true }).fill('  MANCHESTER   city ');
  await page.getByRole('button', { name: 'Add Team', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'already exists' }).waitFor();
  assert.equal(createCalls, 0, 'Duplicate manual team must not be submitted');
  await page.getByLabel('Team names · one per line').fill('Arsenal\n arsenal ');
  await page.getByRole('button', { name: 'Add All Teams' }).click();
  await page.getByRole('alert').filter({ hasText: 'Duplicate team' }).waitFor();
  assert.equal(bulkCalls, 0);
  await page.getByLabel('Team names · one per line').fill('Arsenal\nManchester City');
  await page.getByRole('button', { name: 'Add All Teams' }).click();
  await page.getByRole('alert').filter({ hasText: 'already exist' }).waitFor();
  assert.equal(bulkCalls, 0);
  await page.getByLabel('Team Name', { exact: true }).fill('Liverpool');
  await page.getByRole('button', { name: 'Add Team', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Team added successfully' }).waitFor();
  assert.equal(createCalls, 1);

  await page.goto(`${origin}/tournaments/cup/registration`);
  await page.getByPlaceholder('Your in-game Team / Club name').fill('Manchester City');
  await page.getByRole('button', { name: 'Join Tournament', exact: true }).click();
  await page.locator('form [role="alert"]').filter({ hasText: 'already exists' }).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(contrastFailures, [], 'Theme text and primary controls must remain readable');
  console.log('PASS: 12 club themes × light/dark × 4 widths, persistence, Escape/focus, save failure, duplicate manual/bulk messages, valid addition, self-registration conflict. APIs mocked.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  server.kill();
});
