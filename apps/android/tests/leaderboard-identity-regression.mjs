import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const width of [320, 390, 1280]) {
    let updated = false;
    const row = (userId, name, position, points, entryName) => ({ userId, fullName: name, inGameName: name, position, performancePoints: points, playerCode: `FCA-${userId}`, profileImageUrl: null, tournamentsPlayed: 1, matches: 4, wins: 4, draws: 0, losses: 0, goalsFor: 13, goalsAgainst: 3, goalDifference: 10, winRate: 100, form: 'WWWW', entries: [{ registrationId: userId, tournamentId: 'cup', tournamentName: 'International Friendlies', entryName }] });
    const f = await createUiContext(browser, { width, overrides: {
      '/api/leagues/my': { leagues: [{ membershipType: 'PRIMARY', league: { id: 'phase3', name: 'Arena League' } }] },
      '/api/leagues/phase3/rankings/history': { source: 'OBSERVED_DAILY_SNAPSHOTS', history: [], note: 'No snapshots yet' },
      '/api/leagues/phase3/rankings': async (route, headers) => {
        const mode = new URL(route.request().url()).searchParams.get('mode');
        const rankings = mode === 'DUO' ? [row('duo', 'Duo player', 1, 3, 'Duo team')] : [row('phase3', 'WALES player', 1, 15, 'Wales'), row('second', 'Mexico player', 2, 13, 'Mexico'), row('south', 'thowfiqsiru', 3, updated ? 15 : 12, 'South Korea')];
        return route.fulfill({ headers, json: { success: true, data: { league: { id: 'phase3', name: 'Arena League', code: 'ARENA', logoUrl: null, region: null }, filter: { mode }, summary: { members: 42, rankedPlayers: rankings.length, tournaments: 1, verifiedMatches: 5, lastUpdatedAt: null }, myPosition: mode === 'DUO' ? null : 1, rankings }, error: null } });
      },
    }, onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    } });
    try {
      await f.page.goto('https://fcarena.in/leaderboards?league=phase3');
      const search = f.page.getByRole('searchbox', { name: 'Find a player or team', exact: true });
      await search.waitFor();
      await search.fill('south korea');
      await f.page.getByRole('status').filter({ hasText: '1 of 3 ranked players match' }).waitFor();
      const identity = width >= 768 ? f.page.locator('tbody tr').filter({ hasText: 'South Korea' }) : f.page.locator('[data-player-id="south"]').filter({ visible: true });
      assert(await identity.getByText('thowfiqsiru', { exact: true }).isVisible());
      assert((await identity.innerText()).includes('#3'), 'search must preserve the actual league rank');
      assert((await identity.innerText()).includes('12'), 'team search must retain its verified points');
      await checkLayout(f.page, `leaderboard team search ${width}`);
      await search.fill('does not exist');
      await f.page.getByText('No matching players or teams', { exact: true }).waitFor();
      await f.page.getByRole('button', { name: 'Find my rank · #1', exact: true }).click();
      assert.equal(await search.inputValue(), '');
      await search.fill('FCA-south');
      await f.page.getByRole('status').filter({ hasText: '1 of 3 ranked players match' }).waitFor();
      updated = true;
      await f.page.getByRole('button', { name: 'Refresh leaderboard', exact: true }).click();
      await f.page.getByRole('status').filter({ hasText: '1 of 3 ranked players match' }).waitFor();
      assert((await identity.innerText()).includes('15'), 'refresh must update the points');
      await search.fill('');
      await f.page.getByRole('combobox', { name: 'Competition mode', exact: true }).selectOption('DUO');
      await f.page.getByText('Duo team', { exact: true }).filter({ visible: true }).first().waitFor();
      await search.fill('South Korea');
      await f.page.getByText('No matching players or teams', { exact: true }).waitFor();
      assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px: team/player identity, search by team and ID, original rank, refresh, find my rank, mode scope, layout`);
    } finally { await f.context.close(); }
  }
} finally { await browser.close(); }
