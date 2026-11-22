import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, career, user, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
const memberships = ['phase3', 'secondary'].map((id, index) => ({
  membershipType: index ? 'SECONDARY' : 'PRIMARY', adminRole: null,
  league: { id, name: `League ${id}`, code: id, region: 'India', members: 20, maxMembers: 100 },
}));
const cup = { ...phaseData['/api/tournaments/phase3'].tournament, status: 'ACTIVE', leagueId: 'phase3', leagueName: 'League phase3' };
function fixture(id, hours, changes = {}) {
  return { id, sequence: hours, matchday: hours, roundName: `MATCHDAY ${hours}`, status: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + hours * 3_600_000).toISOString(), tournamentId: 'phase3', tournamentName: cup.name,
    leagueId: 'phase3', leagueName: 'League phase3', match: { id, status: 'SCHEDULED' },
    home: { id: 'home', entryName: 'My Club', members: [{ id: user.id, fullName: user.fullName, inGameName: 'Player One' }] },
    away: { id: `away-${id}`, entryName: `Opponent ${id}`, members: [{ id: `player-${id}`, fullName: `Opponent ${id}`, inGameName: null }] },
    ...changes };
}

try {
  for (const width of [360, 390, 1280]) {
    let fixtures = [fixture('first', 24), fixture('second', 48),
      fixture('completed', 12, { match: { id: 'completed', status: 'COMPLETED' } }),
      fixture('cancelled', 13, { status: 'CANCELLED' }),
      fixture('secondary', 5, { tournamentId: 'secondary', leagueId: 'secondary', leagueName: 'League secondary' })];
    const f = await createUiContext(browser, { width, direct: true, native: width < 500, mode: 'DARK',
      overrides: {
        '/api/auth/preferences/dashboard': { preferences: { hiddenSections: [] } },
        '/api/players/me/dashboard': (route, headers) => route.fulfill({ headers, json: {
          success: true, error: null, data: { career, memberships,
            tournaments: [cup, { ...cup, id: 'secondary', leagueId: 'secondary' }], fixtures },
        } }),
        '/api/matches/second': { match: { ...phaseData['/api/matches/phase3'].match, id: 'second',
          fixture: { ...phaseData['/api/matches/phase3'].match.fixture, id: 'second', roundName: 'MATCHDAY 48',
            home: fixtures[1].home, away: fixtures[1].away } } },
        '/api/matches/second/results': { isLeagueAdmin: false, canVerifyResult: false, confirmedResultSubmissionId: null, submissions: [] },
        '/api/matches/second/ocr/latest': { extraction: null },
        '/api/matches/second/scheduling': { enabled: false, proposals: [] },
        '/api/matches/second/events': (route, headers) => route.fulfill({ headers: { ...headers, 'content-type': 'text/event-stream' },
          body: 'event: connected\ndata: {"type":"connected"}\n\n' }),
      }, onMutation: (route, headers) => {
        assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
        return route.fulfill({ status: 204, headers });
      },
    });
    const requests = [];
    f.page.on('request', request => { if (request.url().includes('/api/')) requests.push(`${request.method()} ${request.url()}`); });
    f.page.on('response', response => { if (response.url().includes('/api/')) requests.push(`${response.status()} ${response.url()}`); });
    try {
      await f.page.goto(origin + '/dashboard');
      const card = f.page.locator('.fc-next-match-panel');
      const nav = card.getByRole('navigation', { name: 'Upcoming match navigation' });
      const next = nav.getByRole('button', { name: 'Next match', exact: false });
      const previous = nav.getByRole('button', { name: 'Previous match', exact: false });
      const open = card.getByRole('link', { name: /View Match/ });
      await open.waitFor();
      assert.equal(await open.getAttribute('href'), '/matches/first');
      assert.equal(await previous.isDisabled(), true);
      assert.match(await nav.innerText(), /1 of 2/);
      await next.click();
      await card.getByRole('button', { name: /View players representing Opponent second$/ }).waitFor();
      assert.equal(await open.getAttribute('href'), '/matches/second');
      assert.equal(await next.isDisabled(), true);
      await previous.click();
      assert.equal(await open.getAttribute('href'), '/matches/first');
      await next.click();
      await checkLayout(f.page, `Next match navigation ${width}px`);

      // A dashboard read must preserve the selected stable ID, even if ordering changes.
      fixtures = [fixture('earlier', 20), ...fixtures];
      const refreshed = f.page.waitForResponse(r => new URL(r.url()).pathname === '/api/players/me/dashboard');
      await f.page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
      await refreshed;
      await nav.getByText('3 of 3', { exact: true }).waitFor();
      assert.equal(await open.getAttribute('href'), '/matches/second');
      await open.click();
      await f.page.waitForURL(url => url.pathname === '/matches/second');
      await f.page.getByText('Opponent second', { exact: true }).first().waitFor();

      await f.page.goto(origin + '/dashboard');
      await next.waitFor();
      await next.click();
      assert.equal(await open.getAttribute('href'), '/matches/first');
      fixtures = fixtures.map(row => row.id === 'first' ? { ...row, match: { id: 'first', status: 'COMPLETED' } } : row);
      const completedRefresh = f.page.waitForResponse(r => new URL(r.url()).pathname === '/api/players/me/dashboard');
      await f.page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
      await completedRefresh;
      await nav.getByText('1 of 2', { exact: true }).waitFor();
      assert.equal(await open.getAttribute('href'), '/matches/earlier');
      await f.page.getByRole('combobox', { name: 'Dashboard league context' }).selectOption('secondary');
      await card.getByRole('button', { name: /View players representing Opponent secondary$/ }).waitFor();
      assert.equal(await open.getAttribute('href'), '/matches/secondary');
      assert.equal(await nav.count(), 0);
      assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px: Next/Previous change opponent and match route, exclude completed/cancelled and other-league fixtures, preserve selection through refresh and recover after completion`);
    } catch (error) {
      console.error(JSON.stringify({ width, url: f.page.url(), errors: f.errors, requests, body: (await f.page.locator('body').innerText()).slice(0, 4000) }));
      throw error;
    } finally { await f.context.close(); }
  }
} finally { await browser.close(); }
