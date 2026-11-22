import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const systemChrome = process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || (existsSync(systemChrome) ? systemChrome : undefined) });
const raceRow = (userId, goals = 10) => ({ position: 1, userId, fullName: userId, inGameName: null,
  playerCode: 'FCA-' + userId, matches: 4, wins: 3, draws: 0, losses: 1, goals, goalsPerMatch: goals / 4,
  goalsAgainst: 3, goalDifference: goals - 3, cleanSheets: 2, cleanSheetRate: 50, goalsAgainstPerMatch: 0.75, rating: 80 });
try {
  for (const width of [320, 390, 1280]) {
    let failSolo = true;
    const tournaments = ['solo', 'team', 'duo'].map(id => ({ id, name: id + ' tournament',
      code: id, status: 'ACTIVE', league: { id: 'phase3', name: 'Arena League' } }));
    const f = await createUiContext(browser, { width, overrides: {
      '/api/awards/overview': { trophyCabinet: {}, myTournamentAwards: [], mySeasonalAwards: [],
        recentSeasonalWinners: [], activeAwardTournaments: tournaments },
      '/api/tournaments/solo/award-races': (route, headers) => route.fulfill({ headers,
        status: failSolo ? 503 : 200, json: failSolo
          ? { success: false, error: { code: 'UNAVAILABLE', message: 'Race temporarily unavailable' } }
          : { success: true, data: { available: true, reason: null, goldenBoot: [raceRow('Solo Star')],
            goldenGlove: [], playerOfTournament: [] }, error: null } }),
      ...Object.fromEntries(['team', 'duo'].map(id => [`/api/tournaments/${id}/award-races`, {
        available: false, reason: 'Update FC Arena to view the verified score races.',
        goldenBoot: [], goldenGlove: [], playerOfTournament: [], verifiedScoreRaces: {
          scope: id === 'team' ? 'TEAM' : 'PLAYER',
          goldenBoot: [{ id, name: id === 'team' ? 'Team Comets' : 'DUO Star', position: 1,
            goals: 12, goalsPerMatch: 3, matches: 4, cleanSheets: 2, goalsAgainstPerMatch: 0.75 }], goldenGlove: [],
        },
      }])) }, onMutation: (route, headers) => {
        assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
        return route.fulfill({ status: 204, headers });
      } });
    try {
      await f.page.goto('https://fcarena.in/awards/golden-boot');
      await f.page.getByText('Team Comets', { exact: true }).waitFor();
      await f.page.getByText('DUO Star', { exact: true }).waitFor();
      await f.page.getByText('Team record · aggregate scores; individual player honours are separate.', { exact: true }).waitFor();
      await f.page.getByText('Player record · verified individual DUO games.', { exact: true }).waitFor();
      await f.page.getByRole('alert').filter({ hasText: '1 tournament race could not be loaded' }).waitFor();
      assert((await f.page.locator('main').innerText()).includes('Refresh needed'));
      assert.equal(await f.page.getByText('Update FC Arena to view the verified score races.', { exact: true }).count(), 0);
      assert.equal(await f.page.getByText('12 goals · 3/M · 4 M', { exact: true }).count(), 2);
      failSolo = false;
      await f.page.getByRole('button', { name: 'Retry award data', exact: true }).click();
      await f.page.getByText('Solo Star', { exact: true }).waitFor();
      await f.page.getByText('10 goals · 2.5/M · 4 M', { exact: true }).waitFor();
      await f.page.getByRole('alert').waitFor({ state: 'detached' });
      await checkLayout(f.page, `Golden Boot ${width}`);
      assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px: SOLO / team / DUO awards, scoring metrics, partial failure and retry, layout`);
    } catch (error) {
      console.error(await f.page.locator('body').innerText());
      console.error(f.errors);
      throw error;
    } finally { await f.context.close(); }
  }

  const row = { ...raceRow('phase3'), fullName: 'Ranking Star', inGameName: null,
    performancePoints: 9, goalsFor: 10, goalsAgainst: 3, winRate: 75, form: 'WWWL' };
  const f = await createUiContext(browser, { width: 390, overrides: {
    '/api/tournaments/phase3/rankings': { tournament: { id: 'phase3', leagueId: 'phase3', name: 'Arena Cup',
      mode: 'SOLO', format: 'ROUND_ROBIN', status: 'ACTIVE' }, myPosition: 1, categories: {
      bestPlayers: [row], mostWins: [row], highestWinRate: [row], bestGoalDifference: [row],
      topGoals: { available: true, entries: [row] }, bestTeams: { available: false, entries: [] },
    } },
  }, onMutation: (route, headers) => route.fulfill({ status: 204, headers }) });
  try {
    await f.page.goto('https://fcarena.in/tournaments/phase3/rankings');
    const metric = f.page.getByRole('list', { name: 'Player rankings', exact: true }).locator('.fc-standing-points');
    await metric.waitFor();
    assert.equal((await metric.innerText()).replace(/\s/g, ''), '9points');
    for (const [tab, expected] of [['Top Goals', '10goals'], ['Most Wins', '3wins'],
      ['Win Rate', '75%win rate'], ['Best GD', '+7goal difference']]) {
      await f.page.getByRole('button', { name: tab, exact: true }).click();
      assert.equal((await metric.innerText()).replace(/\s/g, ''), expected.replace(/\s/g, ''));
    }
    await checkLayout(f.page, 'mobile ranking metrics');
    assert.deepEqual(f.errors, []);
    console.log('PASS 390px: mobile ranking tabs show the selected scoring metric');
  } finally { await f.context.close(); }
} finally { await browser.close(); }
