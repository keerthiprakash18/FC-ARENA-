// Phase 1 reliability/accessibility regressions. Every API call is intercepted.
// Run against a local production web server: node apps/android/tests/phase1-ui.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const user = { id: 'phase1', fullName: 'Phase One Player', role: 'PLAYER', themePreference: 'LUXURY_GOLD', player: { identity: { inGameName: 'Arena Player' } } };
const league = { id: 'phase1', name: 'Arena Test League', code: 'PHASE1', members: 2, maxMembers: 20, pendingApplications: 0 };
const submission = { id: 'result1', homeScore: 2, awayScore: 1, status: 'PENDING_VERIFICATION', source: 'MANUAL', submittedBy: { id: 'phase1', fullName: user.fullName, player: user.player }, reviewedBy: null, rejectionReason: null };
const match = { id: 'phase1', matchCode: 'PHASE1', status: 'SCHEDULED', isLeagueAdmin: true, isParticipant: true, participantSide: 'HOME', readiness: { homeReadyAt: null, awayReadyAt: null, homeReady: false, awayReady: false, bothReady: false }, schedule: { scheduledAt: null, estimatedDeadlineAt: null, matchDurationMinutes: 15 }, tournament: { id: 'phase1', name: 'Arena Cup', mode: 'SOLO', format: 'ROUND_ROBIN' }, league, fixture: { id: 'fixture1', fixtureCode: 'F1', roundName: 'Round 1', roundNumber: 1, matchday: 1, status: 'SCHEDULED', scheduledAt: null, home: { id: 'home-id', entryName: 'Home Team', members: [{ id: 'phase1', fullName: user.fullName }] }, away: { id: 'away-id', entryName: 'Away Team', members: [{ id: 'opponent', fullName: 'Away Player' }] }, homeSource: null, awaySource: null } };
const failures = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

async function prepare(width, native = false) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, serviceWorkers: 'block', reducedMotion: 'reduce', ...(native ? { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0 Mobile Safari/537.36 FC-Arena-Android/1' } : {}) });
  const state = { authStatus: 200, deleteFailure: false, leagueDeleted: false, mutations: [], fixtures: [], confirmed: false, rejected: false };
  const page = await context.newPage();
  page.on('pageerror', error => failures.push(error.message));
  page.on('dialog', dialog => { failures.push(`Unexpected browser ${dialog.type()}`); void dialog.dismiss(); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      const headers = { 'access-control-allow-origin': 'https://fcarena.in', 'access-control-allow-credentials': 'true' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'access-control-allow-headers': 'authorization,content-type' } });
      if (url.pathname === '/api/auth/me' && state.authStatus !== 200) return route.fulfill({ status: state.authStatus, headers, json: { success: false, data: null, error: { code: 'TEST_FAILURE', message: 'Account unavailable' } } });
      let data;
      switch (url.pathname) {
        case '/api/auth/refresh': data = { accessToken: 'phase1-only', expiresIn: 3600 }; break;
        case '/api/auth/me': data = { user }; break;
        case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
        case '/api/leagues/my': data = { leagues: state.leagueDeleted ? [] : [{ membershipType: 'PRIMARY', adminRole: 'OWNER', league }] }; break;
        case '/api/leagues/phase1':
          if (request.method() === 'DELETE') {
            state.mutations.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
            if (state.deleteFailure) return route.fulfill({ status: 500, headers, json: { success: false, data: null, error: { code: 'TEST_FAILURE', message: 'Deletion could not be completed.' } } });
            state.leagueDeleted = true;
          }
          data = { message: 'League deleted.' }; break;
        case '/api/tournaments/phase1/wizard': data = { steps: ['SETUP', 'TEAMS', 'FIXTURE_SETTINGS', 'FIXTURE_PREVIEW', 'REVIEW'] }; break;
        case '/api/tournaments/phase1/entries': data = { entries: [{ id: 'home-id', entryName: 'Home Team' }, { id: 'away-id', entryName: 'Away Team' }] }; break;
        case '/api/tournaments/phase1/wizard/fixture-preview':
          if (request.method() === 'POST') {
            const body = request.postDataJSON();
            state.mutations.push({ path: url.pathname, method: request.method(), body });
            state.fixtures.push({ id: 'fixture1', roundNumber: body.roundNumber, matchday: body.matchday, homeRegistration: { id: body.homeRegistrationId, entryName: 'Home Team' }, awayRegistration: { id: body.awayRegistrationId, entryName: 'Away Team' }, group: null });
          }
          data = { fixtures: state.fixtures }; break;
        case '/api/tournaments/phase1/wizard/fixture-preview/fixture1':
          state.mutations.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
          Object.assign(state.fixtures[0], request.postDataJSON());
          data = {}; break;
        case '/api/matches/phase1': data = { match }; break;
        case '/api/matches/phase1/results': data = { isLeagueAdmin: true, canVerifyResult: true, confirmedResultSubmissionId: state.confirmed ? 'result1' : null, submissions: state.rejected ? [] : [{ ...submission, status: state.confirmed ? 'CONFIRMED' : 'PENDING_VERIFICATION' }] }; break;
        case '/api/matches/phase1/ocr/latest': data = { extraction: null }; break;
        case '/api/matches/phase1/events': return route.fulfill({ headers: { ...headers, 'content-type': 'text/event-stream' }, body: 'event: connected\ndata: {"type":"connected"}\n\n' });
        case '/api/results/result1/reject':
          state.mutations.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
          state.rejected = true;
          data = { message: 'Result rejected.' }; break;
        case '/api/matches/phase1/results/reverse':
          state.mutations.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
          state.confirmed = false;
          data = { message: 'Result reversed.' }; break;
        default: failures.push(`Unmocked API: ${request.method()} ${url.pathname}`); return route.abort();
      }
      return route.fulfill({ headers, json: { success: true, data, error: null } });
    }
    if (url.hostname !== 'fcarena.in') { failures.push(`Unexpected request: ${url.origin}`); return route.abort(); }
    const response = await fetch(`${origin}${url.pathname}${url.search}`, { headers: { ...request.headers(), host: new URL(origin).host } });
    const headers = Object.fromEntries(response.headers);
    for (const key of ['content-encoding', 'transfer-encoding', 'content-length']) delete headers[key];
    return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
  return { context, page, state };
}

try {
  for (const width of [360, 390, 1440]) {
    const { context, page, state } = await prepare(width, width === 390);
    // Failed auth must leave loading, distinguish access failures, and allow recovery.
    for (const status of [401, 403, 500]) {
      state.authStatus = status;
      await page.goto('https://fcarena.in/announcements');
      await page.getByText(status === 401 ? 'Sign in to continue' : status === 403 ? 'Access unavailable' : 'Unable to complete this request', { exact: true }).waitFor();
      assert.equal(await page.getByText('Loading Announcements...', { exact: true }).count(), 0);
    }
    state.authStatus = 200;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('heading', { name: 'Announcements', exact: true }).waitFor();
    if (width === 390) assert.equal(await page.locator('html').getAttribute('data-native-app'), 'android');

    await page.goto('https://fcarena.in/leagues');
    const trigger = page.getByRole('button', { name: 'Delete League', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Delete league?', exact: true });
    await dialog.waitFor();
    assert(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), 'Destructive dialogs initially focus Cancel');
    await page.keyboard.press('Tab');
    assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Focus remains inside modal');
    await page.keyboard.press('Escape');
    assert(await trigger.evaluate(el => el === document.activeElement), 'Escape restores trigger focus');
    assert.equal(state.mutations.length, 0, 'Cancel cannot send a mutation');

    await trigger.click();
    const input = dialog.getByRole('textbox');
    await input.fill('Wrong name');
    await dialog.getByRole('button', { name: 'Delete league', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'League name confirmation does not match.' }).waitFor();
    assert.equal(state.mutations.length, 0, 'Mismatched names cannot delete');
    state.deleteFailure = true;
    await input.fill(league.name);
    await dialog.getByRole('button', { name: 'Delete league', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Deletion could not be completed.' }).waitFor();
    assert.equal(state.mutations.length, 1, 'Failed mutations are never replayed');
    assert.deepEqual(state.mutations[0].body, { confirmName: league.name });
    state.deleteFailure = false;
    await trigger.click();
    await dialog.getByRole('textbox').fill(league.name);
    await dialog.getByRole('button', { name: 'Delete league', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'League deleted.' }).waitFor();
    assert.equal(state.mutations.length, 2);

    await page.goto('https://fcarena.in/tournaments/phase1/wizard/fixture-preview');
    const add = page.getByRole('button', { name: '+ Add Match', exact: true });
    await add.click();
    const form = page.getByRole('dialog', { name: 'Add draft fixture' });
    await form.waitFor();
    await form.getByLabel('Home team', { exact: true }).selectOption('home-id');
    await form.getByLabel('Away team', { exact: true }).selectOption('home-id');
    await form.getByRole('button', { name: 'Add fixture', exact: true }).click();
    await form.getByRole('alert').filter({ hasText: 'Choose two different teams.' }).waitFor();
    assert.equal(state.mutations.length, 2);
    await form.getByLabel('Away team', { exact: true }).selectOption('away-id');
    await form.getByLabel('Matchday', { exact: true }).fill('3');
    await form.getByRole('button', { name: 'Add fixture', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Fixture preview updated.' }).waitFor();
    assert.deepEqual(state.mutations[2].body, { homeRegistrationId: 'home-id', awayRegistrationId: 'away-id', roundNumber: 3, matchday: 3 });
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    const move = page.getByRole('dialog', { name: 'Move draft fixture' });
    await move.getByLabel('Matchday', { exact: true }).fill('4');
    await move.getByRole('button', { name: 'Move fixture', exact: true }).click();
    await page.getByRole('heading', { name: 'Tournament · Matchday 4', exact: true }).waitFor();
    assert.deepEqual(state.mutations[3].body, { roundNumber: 4, matchday: 4 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete draft fixture?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(state.mutations.length, 4);

    // Mobile fit, motion and canonical theme values across both display modes.
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, infinite: document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity).length }));
    assert(metrics.scroll <= width + 1, `Horizontal overflow at ${width}`);
    assert.equal(metrics.infinite, 0);
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => { document.documentElement.dataset.mode = mode; }, mode);
      const tokens = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return { canvas: s.getPropertyValue('--theme-background').trim(), gold: s.getPropertyValue('--fc-gold').trim(), warning: s.getPropertyValue('--theme-warning').trim() }; });
      assert.equal(tokens.canvas, mode === 'light' ? '#f6f4ee' : '#071019');
      assert.notEqual(tokens.gold, tokens.warning, 'Warning and premium accent are separate');
    }

    await page.goto('https://fcarena.in/matches/phase1');
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    const reject = page.getByRole('dialog', { name: 'Reject result?' });
    await reject.getByLabel('Rejection reason (optional)', { exact: true }).fill('Score screenshot does not match.');
    await reject.getByRole('button', { name: 'Reject result', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Result rejected.' }).waitFor();
    assert.deepEqual(state.mutations[4].body, { reason: 'Score screenshot does not match.' });
    state.rejected = false;
    state.confirmed = true;
    await page.reload();
    await page.getByText('Manage verified result', { exact: true }).click();
    await page.getByRole('button', { name: 'Reverse Result Completely', exact: true }).click();
    const reverse = page.getByRole('dialog', { name: 'Reverse confirmed result?' });
    await reverse.getByLabel('Reversal reason', { exact: true }).fill('x');
    await reverse.getByRole('button', { name: 'Continue', exact: true }).click();
    await reverse.getByRole('alert').filter({ hasText: 'at least 3 characters' }).waitFor();
    assert.equal(state.mutations.length, 5);
    await reverse.getByLabel('Reversal reason', { exact: true }).fill('Incorrect match proof');
    await reverse.getByRole('button', { name: 'Continue', exact: true }).click();
    await reverse.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(state.mutations.length, 5, 'Final reversal cancellation sends no mutation');
    await page.getByRole('button', { name: 'Reverse Result Completely', exact: true }).click();
    await reverse.getByLabel('Reversal reason', { exact: true }).fill(' Incorrect match proof ');
    await reverse.getByRole('button', { name: 'Continue', exact: true }).click();
    await reverse.getByRole('button', { name: 'Reverse result', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Result reversed.' }).waitFor();
    assert.deepEqual(state.mutations[5].body, { reason: 'Incorrect match proof' });
    await context.close();
    console.log(`PASS Phase 1 width ${width}: auth recovery, dialogs, validation, payloads, focus, announcements, theme/motion`);
  }
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}
