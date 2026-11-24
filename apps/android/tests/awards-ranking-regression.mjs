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
      '/api/awards/live-races': (route,headers) => route.fulfill({ headers, json: { success:true, error:null, data:{
        races: tournaments.flatMap(tournament => {
          if(tournament.id==='solo') return failSolo ? [] : [{tournament,data:{available:true,reason:null,
            goldenBoot:[raceRow('Solo Star')],goldenGlove:[],playerOfTournament:[]}}];
          return [{tournament,data:{available:false,reason:'Update FC Arena to view the verified score races.',
            goldenBoot:[],goldenGlove:[],playerOfTournament:[],verifiedScoreRaces:{scope:tournament.id==='team'?'TEAM':'PLAYER',
              goldenBoot:[{id:tournament.id,name:tournament.id==='team'?'Team Comets':'DUO Star',position:1,
                goals:12,goalsPerMatch:3,matches:4,cleanSheets:2,goalsAgainstPerMatch:0.75}],goldenGlove:[]}}}];
        }),failed:failSolo?[{tournamentId:'solo'}]:[],pagination:{offset:0,limit:6,total:3,nextOffset:null},
      } } }), }, onMutation: (route, headers) => {
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
      await f.page.getByRole('alert').filter({ hasText: 'tournament race could not be loaded' }).waitFor({ state: 'detached' });
      await checkLayout(f.page, `Golden Boot ${width}`);
      assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px: SOLO / team / DUO awards, scoring metrics, partial failure and retry, layout`);
    } catch (error) {
      console.error(await f.page.locator('body').innerText());
      console.error(f.errors);
      throw error;
    } finally { await f.context.close(); }
  }

  let batchCalls = 0;
  const paged = await createUiContext(browser, { width: 390, overrides: {
    '/api/awards/overview': { trophyCabinet: {}, myTournamentAwards: [], mySeasonalAwards: [], recentSeasonalWinners: [], activeAwardTournaments: [] },
    '/api/awards/live-races': (route, headers) => {
      batchCalls++;
      const offset = Number(new URL(route.request().url()).searchParams.get('offset'));
      return route.fulfill({ headers, json: { success: true, data: {
        races: [{ tournament: { id: String(offset), name: offset ? 'Older Cup' : 'Latest Cup',
          league: { id: 'phase3', name: 'Arena League' } }, data: { available: true,
          goldenBoot: [raceRow(offset ? 'Older Scorer' : 'Latest Scorer')], goldenGlove: [], playerOfTournament: [] } }],
        failed: [], pagination: { offset, limit: 6, total: 7, nextOffset: offset ? null : 6 },
      } } });
    },
  } });
  try {
    await paged.page.goto('https://fcarena.in/awards/golden-boot');
    await paged.page.getByText('Latest Scorer', { exact: true }).waitFor();
    await paged.page.clock.install();
    await paged.page.getByRole('button', { name: 'Next races', exact: true }).click();
    await paged.page.getByText('Older Scorer', { exact: true }).waitFor();
    assert(await paged.page.getByRole('button', { name: 'Next races', exact: true }).isDisabled());
    await paged.page.getByRole('button', { name: 'Previous races', exact: true }).click();
    await paged.page.getByText('Latest Scorer', { exact: true }).waitFor();
    await paged.page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    const before = batchCalls;
    await paged.page.clock.fastForward(61000);
    assert.equal(batchCalls, before, 'Offline screens must not poll');
    await paged.page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
      window.dispatchEvent(new Event('online'));
    });
    await paged.page.waitForFunction(() => document.body.innerText.includes('Latest Scorer'));
    await new Promise(resolve => setTimeout(resolve, 300));
    assert(batchCalls > before, 'Online reconnect must refresh live awards');
    await checkLayout(paged.page, 'paginated award races');
    assert.deepEqual(paged.errors, []);
    console.log('PASS 390px: older tournament pagination, offline polling pause and online refresh');
  } finally { await paged.context.close(); }


  // The old UI displayed only 5 rows and the API previously returned only 20.
  // Exercise complete 27-player SOLO and verified DUO standings on BOTH entry points.
  const soloPlayers = Array.from({ length: 27 }, (_, index) => ({
    ...raceRow(`Player ${String(index + 1).padStart(2, '0')}`, 26 - index),
    position: index + 1,
  }));
  const duoPlayers = Array.from({ length: 27 }, (_, index) => ({
    id: `duo-${index + 1}`, name: `DUO ${String(index + 1).padStart(2, '0')}`,
    position: index + 1, matches: index === 0 ? 9 : 10, games: index === 0 ? 18 : 20, goals: 26 - index,
    goalsPerMatch: Number(((26 - index) / (index === 0 ? 9 : 10)).toFixed(2)),
    goalsPerGame: Number(((26 - index) / (index === 0 ? 18 : 20)).toFixed(2)),
    cleanSheets: index === 0 ? 9 : index % 3,
    cleanSheetRate: index === 0 ? 50 : index % 3 * 5,
    goalsAgainstPerMatch: 1.5, goalsAgainstPerGame: 0.75,
  }));
  const solo = { id: 'solo', name: 'Full SOLO Cup', code: 'SOLO',
    status: 'ACTIVE', mode: 'SOLO', format: 'ROUND_ROBIN',
    league: { id: 'phase3', name: 'Arena League' } };
  const duo = { id: 'duo', name: 'Full DUO Cup', code: 'DUO',
    status: 'ACTIVE', mode: 'DUO', format: 'ROUND_ROBIN',
    league: { id: 'phase3', name: 'Arena League' } };
  const soloRaces = { tournament: solo, available: true, reason: null,
    goldenBoot: soloPlayers, goldenGlove: soloPlayers, playerOfTournament: soloPlayers };
  const duoRaces = { tournament: duo, available: false, reason: 'Verified DUO scores',
    goldenBoot: [], goldenGlove: [], playerOfTournament: [],
    verifiedScoreRaces: { scope: 'PLAYER', goldenBoot: duoPlayers, goldenGlove: duoPlayers } };
  const complete = await createUiContext(browser, { width: 390, overrides: {
    '/api/awards/overview': { trophyCabinet: {}, myTournamentAwards: [], mySeasonalAwards: [],
      recentSeasonalWinners: [], activeAwardTournaments: [solo, duo] },
    '/api/awards/live-races': { races: [
      { tournament: solo, data: soloRaces }, { tournament: duo, data: duoRaces },
    ], failed: [], pagination: { offset: 0, limit: 6, total: 2, nextOffset: null } },
    '/api/tournaments/solo': { tournament: { ...solo, competitionFormat: 'ROUND_ROBIN',
      canManageSettings: false, canManageAdmins: false } },
    '/api/tournaments/solo/groups': { groups: [] },
    '/api/tournaments/solo/achievements': { tournament: { ...solo, completedAt: null },
      isLeagueAdmin: false, achievements: [] },
    '/api/tournaments/solo/award-races': soloRaces,
    '/api/tournaments/duo': { tournament: { ...duo, competitionFormat: 'ROUND_ROBIN',
      canManageSettings: false, canManageAdmins: false } },
    '/api/tournaments/duo/groups': { groups: [] },
    '/api/tournaments/duo/achievements': { tournament: { ...duo, completedAt: null },
      isLeagueAdmin: false, achievements: [] },
    '/api/tournaments/duo/award-races': duoRaces,
  } });
  try {
    for (const slug of ['golden-boot', 'golden-glove']) {
      await complete.page.goto(`https://fcarena.in/awards/${slug}`);
      await complete.page.getByText('Player 27', { exact: true }).waitFor();
      await complete.page.getByText('DUO 27', { exact: true }).waitFor();
      assert.equal(await complete.page.getByText('All 27 verified players ranked', { exact: true }).count(), 2);
      assert.equal(await complete.page.getByText('9 matches · 18 games', { exact: true }).count(), 1);
      assert.equal(await complete.page.getByText('10 matches · 20 games', { exact: true }).count(), 26);
      assert.equal(await complete.page.getByText('18 matches', { exact: true }).count(), 0);
      if (slug === 'golden-glove') {
        await complete.page.getByText('9 CS · 50% CS · 0.75 GA/game', { exact: true }).waitFor();
      }
      await checkLayout(complete.page, `full ${slug} category at 390px`);
    }
    await complete.page.goto('https://fcarena.in/tournaments/solo/achievements');
    await complete.page.getByText('Player 27', { exact: true }).first().waitFor();
    assert.equal(await complete.page.getByText('All 27 verified entries ranked', { exact: false }).count(), 3);
    await checkLayout(complete.page, 'complete SOLO tournament award races');
    await complete.page.goto('https://fcarena.in/tournaments/duo/achievements');
    await complete.page.getByText('DUO 27', { exact: true }).first().waitFor();
    assert.equal(await complete.page.getByText('All 27 verified entries ranked', { exact: false }).count(), 2);
    assert.equal(await complete.page.getByText('9 matches · 18 games', { exact: true }).count(), 2);
    assert.equal(await complete.page.getByText('10 matches · 20 games', { exact: true }).count(), 52);
    await checkLayout(complete.page, 'complete verified DUO award races');
    assert.deepEqual(complete.errors, []);
    assert.deepEqual(complete.mutations, [], 'Browsing races must not write match or award data');
    console.log('PASS 390px: all 27 rows; DUO own fixture/game counts, per-game rates and 50% clean sheets on both award entry points');
  } finally { await complete.context.close(); }

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
    assert.equal((await metric.textContent()).replace(/\s/g, ''), '9points');
    for (const [tab, expected] of [['Top Goals', '10goals'], ['Most Wins', '3wins'],
      ['Win Rate', '75%win rate'], ['Best GD', '+7goal difference']]) {
      await f.page.getByRole('button', { name: tab, exact: true }).click();
      assert.equal((await metric.textContent()).replace(/\s/g, ''), expected.replace(/\s/g, ''));
    }
    await checkLayout(f.page, 'mobile ranking metrics');
    assert.deepEqual(f.errors, []);
    console.log('PASS 390px: mobile ranking tabs show the selected scoring metric');
  } finally { await f.context.close(); }
} finally { await browser.close(); }
