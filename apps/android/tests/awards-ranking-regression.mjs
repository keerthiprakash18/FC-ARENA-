import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const systemChrome = process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || (existsSync(systemChrome) ? systemChrome : undefined) });
const raceRow = (userId, goals = 10) => ({ position: 1, userId, fullName: userId, inGameName: null,
  playerCode: 'FCA-' + userId, matches: 4, wins: 3, draws: 0, losses: 1, goals, goalsPerMatch: goals / 4,
  goalsAgainst: 3, goalDifference: goals - 3, cleanSheets: 2, cleanSheetRate: 50, goalsAgainstPerMatch: 0.75, rating: 80 });
async function expectStat(row, label, value) {
  await row.getByText(label, { exact: true }).locator('..').getByText(String(value), { exact: true }).waitFor();
}
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
      for (const name of ['Team Comets', 'DUO Star']) {
        const row = f.page.getByRole('listitem', { name: `${name}, rank 1`, exact: true });
        await row.getByRole('group', { name: '12 goals', exact: true }).waitFor();
        await expectStat(row, 'Matches', 4);
        await expectStat(row, 'Goals / match', 3);
      }
      failSolo = false;
      await f.page.getByRole('button', { name: 'Retry award data', exact: true }).click();
      await f.page.getByText('Solo Star', { exact: true }).waitFor();
      const soloRow = f.page.getByRole('listitem', { name: 'Solo Star, rank 1', exact: true });
      await soloRow.getByRole('group', { name: '10 goals', exact: true }).waitFor();
      await expectStat(soloRow, 'Goals / match', 2.5);
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
      const ownRow = complete.page.getByRole('listitem', { name: 'DUO 01, rank 1', exact: true });
      await expectStat(ownRow, 'Matches', 9);
      await expectStat(ownRow, 'Games', 18);
      const lastRow = complete.page.getByRole('listitem', { name: 'DUO 27, rank 27', exact: true });
      await expectStat(lastRow, 'Matches', 10);
      await expectStat(lastRow, 'Games', 20);
      assert.equal(await complete.page.getByText('18 matches', { exact: true }).count(), 0);
      if (slug === 'golden-glove') {
        await ownRow.getByRole('group', { name: '9 clean sheets', exact: true }).waitFor();
        await expectStat(ownRow, 'Clean sheet rate', '50%');
        await expectStat(ownRow, 'Conceded / game', 0.75);
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
    for (const name of ['Golden Boot standings', 'Golden Glove standings']) {
      const list = complete.page.getByRole('list', { name, exact: true });
      await expectStat(list.getByRole('listitem', { name: 'DUO 01, rank 1', exact: true }), 'Matches', 9);
      await expectStat(list.getByRole('listitem', { name: 'DUO 01, rank 1', exact: true }), 'Games', 18);
      await expectStat(list.getByRole('listitem', { name: 'DUO 27, rank 27', exact: true }), 'Matches', 10);
      await expectStat(list.getByRole('listitem', { name: 'DUO 27, rank 27', exact: true }), 'Games', 20);
    }
    await checkLayout(complete.page, 'complete verified DUO award races');
    assert.deepEqual(complete.errors, []);
    assert.deepEqual(complete.mutations, [], 'Browsing races must not write match or award data');
    console.log('PASS 390px: all 27 rows; DUO own fixture/game counts, per-game rates and 50% clean sheets on both award entry points');
  } finally { await complete.context.close(); }

  // Visual hierarchy must retain exact player stats, shared ranks and zero-goal
  // rows in both themes, including names that cannot fit a single mobile line.
  const previewPlayers = [
    { id: 'preview-1', name: 'Aryan K', position: 1, matches: 9, games: 18, goals: 27,
      goalsPerMatch: 3, goalsPerGame: 1.5, cleanSheets: 9, cleanSheetRate: 50, goalsAgainstPerMatch: 1, goalsAgainstPerGame: 0.5 },
    { id: 'preview-2', name: 'Surya_07', position: 1, matches: 9, games: 18, goals: 27,
      goalsPerMatch: 3, goalsPerGame: 1.5, cleanSheets: 9, cleanSheetRate: 50, goalsAgainstPerMatch: 1, goalsAgainstPerGame: 0.5 },
    { id: 'preview-3', name: 'தமிழ் வீரர் · LUCIFER_17_KDB_CHAMPIONSHIP_PLAYER', position: 3, matches: 10, games: 20, goals: 18,
      goalsPerMatch: 1.8, goalsPerGame: 0.9, cleanSheets: 3, cleanSheetRate: 15, goalsAgainstPerMatch: 2, goalsAgainstPerGame: 1 },
    { id: 'preview-4', name: 'New Player', position: 4, matches: 2, games: 4, goals: 0,
      goalsPerMatch: 0, goalsPerGame: 0, cleanSheets: 0, cleanSheetRate: 0, goalsAgainstPerMatch: 4, goalsAgainstPerGame: 2 },
  ];
  const previewTournament = { ...duo, id: 'preview', name: 'FC Arena DUO Championship' };
  for (const mode of ['DARK', 'LIGHT']) {
    for (const width of [320, 390, 1280]) {
      const preview = await createUiContext(browser, { width, mode, overrides: {
        '/api/awards/overview': { trophyCabinet: { GOLDEN_BOOT: 0, GOLDEN_GLOVE: 0 }, myTournamentAwards: [],
          mySeasonalAwards: [], recentSeasonalWinners: [], activeAwardTournaments: [previewTournament] },
        '/api/awards/live-races': { races: [{ tournament: previewTournament, data: { available: false,
          goldenBoot: [], goldenGlove: [], playerOfTournament: [], verifiedScoreRaces: {
            scope: 'PLAYER', goldenBoot: previewPlayers, goldenGlove: previewPlayers } } }],
          failed: [], pagination: { offset: 0, limit: 6, total: 1, nextOffset: null } },
      } });
      try {
        for (const slug of ['golden-boot', 'golden-glove']) {
          await preview.page.goto(`https://fcarena.in/awards/${slug}`);
          const first = preview.page.getByRole('listitem', { name: 'Aryan K, rank 1', exact: true });
          await first.waitFor();
          assert.equal(await preview.page.getByText('Joint leader', { exact: true }).count(), 2);
          await expectStat(first, 'Matches', 9); await expectStat(first, 'Games', 18);
          if (slug === 'golden-glove') await expectStat(first, 'Clean sheet rate', '50%');
          else await first.getByRole('group', { name: '27 goals', exact: true }).waitFor();
          await preview.page.getByRole('listitem', { name: 'New Player, rank 4', exact: true }).waitFor();
          assert.equal(await preview.page.locator('details').first().evaluate(element => element.open), false);
          assert(await preview.page.getByRole('list', { name: slug === 'golden-boot' ? 'Golden Boot standings' : 'Golden Glove standings', exact: true })
            .evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('details')) & Node.DOCUMENT_POSITION_FOLLOWING)),
            'Standings must appear before optional scoring rules');
          await checkLayout(preview.page, `${slug} ${mode} ${width}`);
          if (process.env.AWARD_UI_OUTPUT) {
            mkdirSync(process.env.AWARD_UI_OUTPUT, { recursive: true });
            await preview.page.screenshot({ path: path.join(process.env.AWARD_UI_OUTPUT, `${slug}-${mode}-${width}.png`), fullPage: true });
          }
          if (width === 320) {
            await preview.page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
            await checkLayout(preview.page, `${slug} ${mode} large text`);
            await preview.page.evaluate(() => { document.documentElement.style.fontSize = ''; });
          }
        }
        assert.deepEqual(preview.errors, []);
        assert.deepEqual(preview.mutations, []);
      } finally { await preview.context.close(); }
    }
  }
  console.log('PASS: redesigned award boards at 320/390/1280px, light/dark, shared leaders, long names, large text and unchanged own-player stats');

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
