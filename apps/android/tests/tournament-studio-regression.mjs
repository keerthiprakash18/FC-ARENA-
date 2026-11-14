import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { _android, chromium } from 'playwright';
import { checkLayout, createUiContext } from './phase-ui-harness.mjs';

const output = process.env.FC_STUDIO_SCREENSHOTS;
const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const testId = randomUUID().slice(0, 8);
const league = { id: 'studio-league-' + testId, name: 'KICKOFF FC', code: 'KF-X3MU' };
const leagueB = { id: 'studio-league-b-' + testId, name: 'FC ARENA TAMIL', code: 'FCAT' };
const tournament = {
  id: 'studio-demo-' + testId, leagueId: league.id, name: 'Friday Night Cup', mode: 'DUO', competitionFormat: 'LEAGUE_ROUND_ROBIN',
  status: 'DRAFT', groupMode: 'SINGLE_GROUP', legType: 'SINGLE_LEG', fixtureMode: 'AUTOMATIC', registrationMode: 'ADMIN_ONLY',
  maxEntries: 8, teamSize: 2, description: '', qualifiersPerGroup: null, playoffQualifiersTotal: null, groups: [], _count: { fixtures: 0, matches: 0 },
};
const pool = ['Vinod FC', 'Raja United', 'Mithun', 'Gokul', 'Aadhi', 'Sriram', 'Hari FC',
  ...Array.from({ length: 35 }, (_, index) => 'League player ' + (index + 8))].map((name, index) => ({ id: 'p' + index, name, avatar: null }));
const listRows = [
  { ...tournament, status: 'ACTIVE', name: 'KICKOFF Championship', id: 'live-demo', startAt: '2026-11-23', code: 'KFC-DEMO', approvedEntries: 8, canManageSettings: true },
  { ...tournament, code: 'DRAFT01', approvedEntries: 0, startAt: null, canManageSettings: true },
  { ...tournament, id: 'old-demo', name: 'International Friendlies', status: 'COMPLETED', code: 'ARCHIVE', approvedEntries: 8, canManageSettings: true },
];
const physical = process.env.FC_STUDIO_ANDROID === '1';
const device = physical ? (await _android.devices())[0] : undefined;
if (physical) assert(device, 'Connect a real Android device with USB debugging.');
const existingPage = device ? await (await device.webView({ pkg: 'in.fcarena.app.debug' }, { timeout: 25000 })).page() : undefined;
const browser = physical ? null : await chromium.launch({ executablePath: process.env.FC_STUDIO_BROWSER, args: ['--no-first-run', '--disable-gpu'] });
try {
  if (output) await mkdir(output, { recursive: true });
  const widths = physical ? ['android'] : [360, 390, 430, 1440];
  for (const width of widths) {
    const studio = { tournament: structuredClone(tournament), entries: [], fixtures: [], history: [], publishedFixtureCount: 0, revision: 'a'.repeat(64), editable: true, availablePlayers: [...pool] };
    const respond = (route, data) => route.fulfill({ json: { success: true, data, error: null } });
    const auth = await createUiContext(browser, {
      width, native: physical || width < 500, direct: !physical, existingPage, allowedHost: physical ? "studio-test.fcarena.in" : undefined, reducedMotion: width === 360 ? 'reduce' : 'no-preference',
      overrides: {
        ['/api/tournaments/' + tournament.id + '/entries']: { entries: [] },
        '/api/mobile/android/version': { updateAvailable: false, latest: null },
        '/api/notifications/push/status': { configured: false, bound: false },
        '/api/leagues/my': { leagues: [{ adminRole: 'OWNER', membershipType: 'PRIMARY', league }, { adminRole: 'ADMIN', membershipType: 'SECONDARY', league: leagueB }] },
        ['/api/leagues/' + league.id + '/tournaments']: { tournaments: listRows },
        ['/api/leagues/' + leagueB.id + '/tournaments']: { tournaments: [] },
        ['/api/tournaments/' + tournament.id + '/studio']: (_route) => respond(_route, studio),
      },
      onMutation(route) {
        const path = new URL(route.request().url()).pathname;
        const body = route.request().postDataJSON() ?? {};
        if (path.endsWith('/tournament-studio')) {
          studio.tournament = { ...studio.tournament, ...body };
          return respond(route, { tournament: studio.tournament });
        }
        if (path.endsWith('/studio/draw')) {
          if (body.kind === 'CLUB') {
            const entry = studio.entries.find(item => item.id === body.entryId);
            assert(entry);
            assert(!body.clubs.some(club => studio.entries.some(item => item.name === club)));
            entry.name = body.clubs[0];
            const outcome = { kind: 'CLUB', entryId: entry.id, winner: entry.name, options: body.clubs };
            studio.history.unshift({ requestId: body.requestId, outcome });
            return respond(route, outcome);
          }
          const options = body.kind === 'MANUAL' ? studio.availablePlayers :
            studio.availablePlayers.filter(player => body.poolPlayerIds.includes(player.id));
          const members = body.kind === 'MANUAL' ? options.filter(player => body.playerIds.includes(player.id)) : options.slice(0, 2);
          const entry = { id: 'entry-' + studio.entries.length, name: body.name || null, captainId: members[0].id, members, valid: true, status: 'APPROVED', groupId: null, logo: null };
          const outcome = { kind: body.kind, entries: [entry], options, unassigned: options.length - members.length };
          studio.entries.push(entry);
          studio.availablePlayers = studio.availablePlayers.filter(player => !members.includes(player));
          studio.history.unshift({ requestId: body.requestId, outcome });
          return respond(route, outcome);
        }
        if (path.endsWith('/fixture-preview/generate')) {
          studio.editable = false;
          studio.tournament._count.fixtures = 1;
          studio.fixtures.push({ id: 'preview-1', roundName: 'Matchday 1', sequence: 1, homeRegistrationId: studio.entries[0].id, awayRegistrationId: studio.entries[1].id });
          return respond(route, { fixtures: 1 });
        }
        if (path.endsWith('/studio/publish')) {
          assert.deepEqual(body, { confirmed: true, revision: studio.revision });
          studio.publishedFixtureCount = 1;
          studio.tournament.status = 'ACTIVE';
          return respond(route, { id: studio.tournament.id });
        }
        throw Error('Unexpected mutation ' + path);
      },
    });
    const { page, context, errors } = auth;
    if (physical) await context.route(/^https:\/\/fcarena\.in\/(?:icons\/icon-(?:192|512)-v3\.png|favicon\.ico)$/, async route => {
      const asset = await fetch(origin + new URL(route.request().url()).pathname);
      return route.fulfill({ status: asset.status, contentType: asset.headers.get('content-type') ?? 'image/png', body: Buffer.from(await asset.arrayBuffer()) });
    });
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push(request.failure()?.errorText + ' ' + request.url()));
    page.on('console', message => { if (message.type() === 'error') failedRequests.push(message.text()); });
    const snap = async name => {
      await checkLayout(page, name + ' ' + width);
      if (output) await page.screenshot({ path: output + '/' + name + '-' + width + '.png', animations: 'disabled' });
      if (!physical && width === 390 && process.env.FC_STUDIO_AXE) {
        await page.addScriptTag({ path: process.env.FC_STUDIO_AXE });
        const result = await page.evaluate(async () => {
          const heading = document.querySelector('main h1');
          const container = heading?.closest('header')?.parentElement || heading?.parentElement?.parentElement || document.querySelector('main');
          const tested = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } });
          return tested.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) }));
        });
        assert.deepEqual(result, [], 'Automated accessibility violations on ' + name);
      }
    };
    await page.goto((physical ? 'https://studio-test.fcarena.in' : origin) + '/tournaments?leagueId=' + league.id, { waitUntil: 'domcontentloaded' });
    try { await page.getByRole('heading', { name: 'KICKOFF Championship' }).waitFor({ timeout: 16000 }); }
    catch (error) {
      console.error({ url: page.url(), errors: errors.slice(-12), failedRequests: failedRequests.slice(-15), body: await page.locator('body').innerText().catch(() => '') });
      if (output) await page.screenshot({ path: output + '/studio-diagnostic-' + width + '.png' }).catch(() => {});
      throw error;
    }
    await snap('cup-center');
    await page.getByRole('button', { name: /^Completed/ }).click();
    await page.getByRole('heading', { name: 'International Friendlies' }).waitFor();
    await page.getByRole('combobox', { name: 'Select tournament league' }).selectOption(leagueB.id);
    await page.getByRole('heading', { name: 'No completed tournaments' }).waitFor();
    await page.getByRole('combobox', { name: 'Select tournament league' }).selectOption(league.id);
    await page.waitForURL(new RegExp('leagueId=' + league.id + '(&|$)'));
    await page.getByRole('heading', { name: 'International Friendlies' }).waitFor();
    await page.getByRole('link', { name: 'Duo 2 players' }).click();
    const name = page.getByLabel('Tournament name');
    await name.fill('Friday Night Cup');
    assert(await page.getByRole('radio', { name: /Duo/ }).isChecked());
    await snap('studio-basics');
    await name.press('Enter');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Participants');
    await page.getByLabel('Duo teams').fill('20');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.getByLabel('Duo teams').inputValue(), '20');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('heading', { name: 'Basics', exact: true }).waitFor();
    assert.equal(await name.inputValue(), 'Friday Night Cup');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Participants', exact: true }).waitFor();
    await snap('studio-participants');
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await page.getByRole('button', { name: 'Select eligible players' }).click();
    await page.getByText('Selected 40 of 40 players', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirm player pool' }).click();
    await page.getByText('40 players remain in this pool', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('40 players remain in this pool', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Spin player wheel' }).click();
    if (physical) {
      const motion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (!motion) {
        await page.getByText('40 players on this wheel', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Skip animation' }).waitFor();
        const intervals = await page.evaluate(() => new Promise(resolve => {
          const timeline = [];
          let previous = performance.now();
          const record = now => {
            timeline.push(now - previous);
            previous = now;
            if (timeline.length === 75) resolve(timeline); else requestAnimationFrame(record);
          };
          requestAnimationFrame(record);
        }));
        intervals.shift();
        const sorted = [...intervals].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * .95)];
        const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        console.log('Android player wheel rAF', { samples: intervals.length, meanMs: mean.toFixed(1), p95Ms: p95.toFixed(1) });
        assert(p95 < 28, 'Android draw frame pacing exceeded 28ms at p95');
        if (output) await page.screenshot({ path: output + '/studio-player-wheel-android.png' });
        await page.getByRole('button', { name: 'Skip animation' }).click();
      }
    } else if (width !== 360) {
      await page.getByText('40 players on this wheel', { exact: true }).waitFor();
      await checkLayout(page, 'wheel ' + width);
      if (width === 390) {
        await page.getByText('Player 1 selected', { exact: false }).waitFor();
        await page.getByText('39 players on this wheel', { exact: true }).waitFor();
        await page.getByText('Player 2 selected', { exact: false }).waitFor();
      }
      if (output) await page.screenshot({ path: output + '/studio-player-wheel-' + width + '.png' });
      await page.getByRole('button', { name: 'Skip animation' }).click();
    }
    await page.getByRole('heading', { name: 'Duo confirmed' }).waitFor();
    await page.getByText('38 players remain in this pool', { exact: true }).waitFor();
    await page.locator('summary').filter({ hasText: 'Remaining players' }).click();
    const remaining = page.getByRole('list').filter({ has: page.getByText('Mithun', { exact: true }) }).first();
    assert.equal(await remaining.getByText('Vinod FC', { exact: true }).count(), 0);
    await page.locator('summary').filter({ hasText: 'Remaining players' }).click();
    await snap('studio-draw');
    await page.getByRole('button', { name: 'Spin player wheel' }).click();
    if (width !== 360) await page.getByRole('button', { name: 'Skip animation' }).click();
    await page.getByText('36 players remain in this pool', { exact: true }).waitFor();
    assert.equal(new Set(studio.entries.flatMap(entry => entry.members.map(player => player.id))).size, 4);
    await page.getByRole('button', { name: 'Club wheel' }).click();
    await page.getByLabel('Club names, one per line').fill('Club North\nClub South');
    await page.getByRole('button', { name: 'Spin club wheel' }).click();
    if (width !== 360) await page.getByRole('button', { name: 'Skip animation' }).click();
    await page.getByRole('heading', { name: 'Club assigned' }).waitFor();
    assert.equal(studio.entries[0].name, 'Club North');
    await page.getByRole('button', { name: 'Spin club wheel' }).click();
    if (width !== 360) await page.getByRole('button', { name: 'Skip animation' }).click();
    await page.getByRole('heading', { name: 'Club assigned' }).waitFor();
    assert.equal(studio.entries[1].name, 'Club South');
    await page.getByRole('button', { name: 'Review tournament' }).click();
    await page.getByRole('button', { name: 'Generate fixture preview' }).click();
    const publish = page.getByRole('button', { name: 'Publish tournament' });
    await publish.waitFor();
    assert(await publish.isDisabled());
    await snap('studio-review');
    await page.getByRole('checkbox', { name: /I have reviewed/ }).check();
    await publish.click();
    await page.getByText('Tournament published.').waitFor();
    assert.deepEqual(errors.filter(error => !error.startsWith('Unmocked API: ')), []);
    if (!physical) await context.close();
    console.log('Cup and Studio pass at ' + (physical ? 'the physical Android WebView' : width + 'px'));
  }
} finally { await browser?.close(); await device?.close(); }
