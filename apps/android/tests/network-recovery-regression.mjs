import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, career, user, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const tournament = { ...phaseData['/api/tournaments/phase3'].tournament, status: 'ACTIVE' };
    const fixture = { ...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0], group: null,
      tournamentId: 'phase3', tournamentName: tournament.name, leagueId: 'phase3', leagueName: 'Arena League',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), match: { id: 'phase3', status: 'SCHEDULED' },
      home: { id: 'home', entryName: 'Home Club', entryLogoUrl: null,
        members: [{ id: user.id, fullName: 'Home Player', inGameName: 'Home FC' }] },
      away: { id: 'away', entryName: 'Away Club', entryLogoUrl: null,
        members: [{ id: 'opponent', fullName: 'Away Player', inGameName: 'Away FC' }] } };
    let available = true, dashboardReads = 0;
    let resolvePreferences;
    const preferencesSeen = new Promise(resolve => { resolvePreferences = resolve; });
    const pendingPreferences = [];
    let delayPreferences = true;
    const { context, page, errors, mutations } = await createUiContext(browser, {
      width, native: width < 500, direct: true, mode: 'DARK', overrides: {
        '/api/auth/preferences/dashboard': (route, headers) => {
          if (!delayPreferences) return route.fulfill({ headers, json: { success: true,
            data: { preferences: { hiddenSections: [] } }, error: null } });
          pendingPreferences.push({ route, headers }); resolvePreferences();
        },
        '/api/players/me/dashboard': (route, headers) => {
          dashboardReads++;
          return route.fulfill(available ? { headers, json: { success: true,
            data: { career, memberships: phaseData['/api/leagues/my'].leagues, tournaments: [tournament], fixtures: [fixture] }, error: null } }
            : { headers, status: 503, json: { success: false, data: null,
              error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' } } });
        },
      }, onMutation: (route, headers) => {
        assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
        return route.fulfill({ status: 204, headers });
      },
    });
    try {
      await context.addCookies([{ name: 'network-test-session', value: 'preserve-me', url: origin }]);
      await page.goto(`${origin}/dashboard`);
      const home = page.getByRole('button', { name: 'View players representing Home Club', exact: true });
      await home.waitFor();
      await preferencesSeen;
      assert(pendingPreferences.length > 0, 'Home must render while preferences are still pending');
      delayPreferences = false;
      await Promise.all(pendingPreferences.map(({ route, headers }) => route.fulfill({ headers,
        json: { success: true, data: { preferences: { hiddenSections: [] } }, error: null } })));
      console.log(`PASS ${width}px: Home renders without waiting for preferences`);

      available = false;
      await page.reload();
      await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
      assert.equal(await home.count(), 0);
      await context.setOffline(true);
      available = true;
      await context.setOffline(false);
      await home.waitFor();
      await home.getByText('Home', { exact: true }).waitFor();
      console.log(`PASS ${width}px: an unavailable startup recovers when the connection returns`);

      const before = dashboardReads;
      await context.setOffline(true);
      fixture.away.entryName = 'Recovered Opponent';
      await context.setOffline(false);
      await home.waitFor();
      await page.getByRole('button', { name: 'View players representing Recovered Opponent', exact: true }).waitFor();
      assert.equal(dashboardReads, before + 1, 'reconnect must issue one background dashboard read');
      assert((await context.cookies()).some(cookie => cookie.name === 'network-test-session' && cookie.value === 'preserve-me'));
      await checkLayout(page, `network recovery ${width}px`);
      assert.deepEqual(errors, []);
      assert(mutations.every(mutation => mutation.path === '/api/telemetry/web-vitals'));
      console.log(`PASS ${width}px: reconnect refreshes once, preserves the session and keeps the page visible`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
