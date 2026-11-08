import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, user, career, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3102';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const ok = (route, headers, data) => route.fulfill({ headers, json: { success: true, data, error: null } });
const fail = (route, headers, status = 503) => route.fulfill({ status, headers, json: { success: false, data: null, error: { code: 'TEMPORARY', message: 'Temporary interruption' } } });
const leagueIds = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const availableLeagues = leagueIds.map((id, i) => ({ id, name: i ? 'FCR' : 'FCNL', isMember: true }));
const scoped = id => ({ ...career, availableLeagues, scope: { leagueId: id, name: id ? availableLeagues.find(l => l.id === id).name : 'Overall' }, lifetimeStatistics: { ...career.lifetimeStatistics, matches: !id ? 16 : id === leagueIds[0] ? 10 : 6 } });
const cup = { ...tournament, name: 'INTERNATIONAL FRIENDLIES', status: 'REGISTRATION_OPEN', maxEntries: 24, approvedEntries: 19, pendingEntries: 1, registeredEntries: 20, isLeagueAdmin: true, canManageParticipants: true, canManageAdmins: true, canGenerateFixtures: true };
const pending = { id: 'pending-one', entryName: 'Kickoff pending team', status: 'PENDING', createdAt: '2026-11-07T12:00:00Z', reviewedAt: null, registeredBy: user, members: [{ user }] };
const telemetry = (route, headers) => { assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals'); return route.fulfill({ status: 204, headers }); };
await mkdir('.cache/career-stability', { recursive: true });
let passed = 0;
try {
  for (const width of [320, 390, 1280]) {
    let unavailable = false;
    const f = await createUiContext(browser, { width, direct: true, native: width < 500, mode: 'DARK', overrides: {
      '/api/players/me/career': (route, headers) => unavailable ? fail(route, headers) : ok(route, headers, scoped(new URL(route.request().url()).searchParams.get('leagueId'))),
      ...Object.fromEntries(leagueIds.map(id => [`/api/leagues/${id}/rankings`, { myPosition: 3 }])),
      '/api/achievements/me': { achievements: [], seasonalAwards: [] },
    }, onMutation: telemetry });
    try {
      await f.page.goto(origin + '/career');
      await f.page.getByRole('group', { name: 'Choose career league' }).waitFor();
      assert.equal(await f.page.getByRole('button', { name: 'Overall', exact: true }).getAttribute('aria-pressed'), 'true');
      for (const [i, name] of ['FCNL','FCR'].entries()) {
        await f.page.getByRole('button', { name, exact: true }).click();
        await f.page.getByText(`Verified performance in ${name}.`, { exact: true }).waitFor();
        assert.equal(new URL(f.page.url()).searchParams.get('leagueId'), leagueIds[i]);
        await f.page.getByRole('link', { name: /League rank #3/ }).waitFor();
        await checkLayout(f.page, `career ${name} ${width}`);
      }
      for (const name of ['Matches','Tournaments','Leagues','Achievements','Stats']) {
        await f.page.getByRole('navigation', { name: 'Career sections' }).getByRole('link', { name, exact: true }).click();
        await f.page.waitForURL(url => url.pathname === (name === 'Stats' ? '/career' : `/career/${name.toLowerCase()}`));
        await f.page.getByRole('group', { name: 'Choose career league' }).waitFor();
        assert.equal(new URL(f.page.url()).searchParams.get('leagueId'), leagueIds[1]);
        assert.equal(await f.page.getByRole('button', { name: 'FCR', exact: true }).getAttribute('aria-pressed'), 'true');
      }
      unavailable = true;
      await f.page.getByRole('button', { name: 'FCNL', exact: true }).click();
      await f.page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
      assert.equal(new URL(f.page.url()).pathname, '/career');
      unavailable = false;
      await f.page.getByRole('button', { name: 'Try again', exact: true }).click();
      await f.page.getByText('Verified performance in FCNL.', { exact: true }).waitFor();
      await f.page.screenshot({ path: `.cache/career-stability/career-${width}.png`, fullPage: true });
      assert.deepEqual(f.errors, []); passed++; console.log(`PASS ${width}px league filters, scoped links, leaderboard and retry`);
    } finally { await f.context.close(); }
  }
  for (const path of ['/tournaments/phase3/registration','/tournaments/phase3/teams','/tournaments/phase3']) {
    let available = false;
    const f = await createUiContext(browser, { width: 390, direct: true, native: true, overrides: {
      '/api/tournaments/phase3': (route, headers) => available ? ok(route, headers, { tournament: cup }) : fail(route, headers),
      '/api/tournaments/phase3/registrations': { registrations: [pending] },
      '/api/tournaments/phase3/entries': { entries: [{ ...pending, fixtureCount: 0 }], maxEntries: 24 },
      '/api/roles/tournaments/phase3/match-admins': (route, headers) => fail(route, headers, 403),
      '/api/tournaments/phase3/match-admins': (route, headers) => fail(route, headers, 403),
      '/api/security/roles/TOURNAMENT/phase3': (route, headers) => fail(route, headers, 403),
    }, onMutation: telemetry });
    try {
      await f.page.goto(origin + path); await f.page.getByRole('button', { name: 'Try again', exact: true }).first().waitFor();
      assert.equal(new URL(f.page.url()).pathname, path);
      available = true; await f.page.getByRole('button', { name: 'Try again', exact: true }).first().click();
      await f.page.locator('h1').waitFor();
      if (path.endsWith('/registration')) { await f.page.getByText('20 registered', { exact: true }).waitFor(); await f.page.getByText('Kickoff pending team', { exact: true }).first().waitFor(); }
      if (path.endsWith('/teams')) await f.page.getByText('Kickoff pending team', { exact: true }).first().waitFor();
      assert.equal(new URL(f.page.url()).pathname, path); await checkLayout(f.page, path); assert.deepEqual(f.errors, []);
      passed++; console.log(`PASS ${path} recovers in place and preserves visible registrations`);
    } finally { await f.context.close(); }
  }
  {
    let reads = 0, documents = 0, refreshTokens = 0;
    const f = await createUiContext(browser, { width: 390, direct: true, native: true, overrides: {
      '/api/leagues/my': (route, headers) => { reads++; return ok(route, headers, { leagues: [] }); },
      '/api/auth/refresh': (route, headers) => { refreshTokens++; return ok(route, headers, { accessToken: 'fixture-only', expiresIn: 3600 }); },
    }, onMutation: telemetry });
    f.page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') documents++; });
    try {
      await f.page.goto(origin + '/more'); await f.page.getByRole('heading', { name: 'More', exact: true }).waitFor();
      const before = { reads, documents, refreshTokens };
      await f.page.getByRole('button', { name: 'Refresh app', exact: true }).focus(); await f.page.keyboard.press('Enter');
      assert.equal(await f.page.getByText('Refresh app data', { exact: true }).count(), 0);
      await f.page.waitForTimeout(1800);
      assert(reads > before.reads); assert.equal(documents, before.documents); assert.equal(refreshTokens, before.refreshTokens); assert.equal(new URL(f.page.url()).pathname, '/more'); assert.deepEqual(f.errors, []);
      passed++; console.log('PASS refresh updates reads without document navigation or losing the auth session');
    } finally { await f.context.close(); }
  }
  {
    let bindings = 0;
    const f = await createUiContext(browser, { width: 390, direct: true, native: true, overrides: { '/api/notifications/push/status': { configured: true, bound: false } }, onMutation: (route, headers) => {
      if (new URL(route.request().url()).pathname === '/api/notifications/push/register') { bindings++; assert.deepEqual(JSON.parse(route.request().postData()), { token: 'mock-fcm-device' }); return ok(route, headers, {}); }
      return telemetry(route, headers);
    } });
    await f.context.addInitScript(() => { window.__fcPush = { supported: true, configured: true, enabled: true, token: 'mock-fcm-device', error: '' }; });
    try {
      await f.page.goto(origin + '/notifications'); await f.page.getByRole('button', { name: 'Disable phone notifications', exact: true }).waitFor();
      await f.page.waitForTimeout(300); const before = bindings; assert(before > 0);
      await f.page.evaluate(() => window.dispatchEvent(new Event('fc-arena:signed-in'))); await f.page.waitForTimeout(500);
      assert(bindings > before, 'same device token must bind again for a new signed-in session'); assert.deepEqual(f.errors, []);
      passed++; console.log('PASS inbox exposes phone controls and rebinds the same device on sign-in');
    } finally { await f.context.close(); }
  }
  console.log(JSON.stringify({ passed }));
} finally { await browser.close(); }
