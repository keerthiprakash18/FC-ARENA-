import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3102';
const executablePath = process.env.CHROMIUM_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const ok = (route, headers, data) => route.fulfill({ headers, json: { success: true, data, error: null } });
await mkdir('.cache/tournament-groups', { recursive: true });
let passed = 0;
try {
  for (const width of [320, 390, 1280]) for (const mode of ['LIGHT', 'DARK']) {
    let serial = 0, sequence = 0;
    let state = {
      revision: 'a'.repeat(64), tournament: { id: 'phase3', name: 'International Friendlies', code: 'FCA-T-TEST', leagueId: 'phase3', status: 'ACTIVE', groupMode: 'MULTIPLE_GROUPS', legType: 'SINGLE_LEG', maxEntries: 42, hasFixtures: true },
      canManage: true, canChangeMembership: true, membershipReason: null, protectedEntryIds: [], unassigned: [],
      groups: [7, 6, 6, 5, 6, 6, 6].map((count, i) => ({ id: `group-${i}`, name: `Group ${String.fromCharCode(65 + i)}`, position: i + 1,
        entries: Array.from({ length: count }, () => ({ id: `team-${++serial}`, name: `Football Team ${serial}`, logoUrl: null, members: [] })) })),
    };
    const original = structuredClone(state), plans = [], saved = [];
    const f = await createUiContext(browser, { width, native: width < 700, direct: true, mode, overrides: {
      '/api/tournaments/phase3': { tournament: { ...tournament, ...state.tournament, isLeagueAdmin: true, canManageAdmins: false } },
      '/api/tournaments/phase3/registrations': { registrations: [] },
      '/api/tournaments/phase3/groups/editor': (r, h) => ok(r, h, { editor: state }),
      '/api/tournaments/fresh/groups/editor': (r, h) => ok(r, h, { editor: { ...state, tournament: { ...state.tournament, id: 'fresh', hasFixtures: false } } }),
      '/api/tournaments/phase3/fixtures/full-reset-preview': { allowed: false, blocker: 'Recorded results exist. Reset blocked to protect history.' },
      '/api/tournaments/phase3/fixtures/restart-with-teams-preview': { tournamentName: state.tournament.name, approvedTeamsToCarry: 42, groupsToSetUp: 7, historicalFixturesKept: 105 },
    }, onMutation: (r, h) => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/api/telemetry/web-vitals') return r.fulfill({ status: 204, headers: h });
      const input = r.request().postDataJSON();
      if (path.endsWith('/groups/reorganize/preview')) {
        plans.push(input);
        assert.deepEqual(input.groups.map(g => g.registrationIds.length), [6, 6, 6, 6, 6, 6, 6]);
        return ok(r, h, { preview: { planHash: 'b'.repeat(64), groups: input.groups.map(g => ({ name: g.name, teams: g.registrationIds.length })), impact: { movedTeams: 1, renamedGroups: 0, newGroups: 0, deletedGroups: 0, fixturesKept: 100, fixturesRemoved: 6, fixturesCreated: 5, fixturesReslotted: 0, resultsPreserved: 1 } } });
      }
      if (path.endsWith('/groups/reorganize')) {
        const entries = new Map(state.groups.flatMap(g => g.entries).map(e => [e.id, e]));
        state = { ...state, revision: String(++sequence).repeat(64), groups: input.groups.map((g, i) => ({ id: g.id, name: g.name, position: i + 1, entries: g.registrationIds.map(id => entries.get(id)) })) };
        saved.push(input);
        return ok(r, h, { editor: state, message: 'Groups saved.' });
      }
      assert.equal(path, '/api/tournaments/phase3/fixtures/restart-with-teams');
      assert.equal(input.confirmation, original.tournament.name);
      return ok(r, h, { tournamentId: 'fresh', carriedTeams: 42, groupCount: 7, message: 'History preserved.' });
    } });
    try {
      // Exercise the compatibility fallback used by older Android WebViews.
      await f.context.addInitScript(() => { Array.prototype.findLastIndex = undefined; Object.defineProperty(crypto, 'randomUUID', { value: undefined }); });
      f.page.on('dialog', async dialog => { f.errors.push('Unexpected native browser dialog'); await dialog.dismiss(); });
      await f.page.goto(origin + '/tournaments/phase3/groups');
      await f.page.getByRole('heading', { name: 'Group Manager', exact: true }).waitFor();
      await checkLayout(f.page, `${width} ${mode} initial groups`);
      await f.page.getByRole('button', { name: 'Auto-balance groups', exact: true }).click();
      await f.page.getByRole('button', { name: 'Review changes', exact: true }).click();
      await f.page.getByRole('button', { name: 'Apply reviewed changes', exact: true }).click();
      await f.page.getByText('Groups saved.', { exact: true }).waitFor();
      assert.equal(saved.length, 1);
      assert.equal(new Set(saved[0].groups.flatMap(g => g.registrationIds)).size, 42);
      const first = state.groups[0].entries[0].id, second = state.groups[1].entries[0].id;
      await f.page.getByRole('combobox', { name: /^First team/ }).selectOption(first);
      await f.page.getByRole('combobox', { name: /^Second team/ }).selectOption(second);
      await f.page.getByRole('button', { name: 'Swap in draft', exact: true }).click();
      await f.page.getByLabel('Group 1 name', { exact: true }).fill('Pool A');
      await f.page.getByRole('button', { name: 'Review changes', exact: true }).click();
      assert(plans[1].groups[0].registrationIds.includes(second));
      assert(plans[1].groups[1].registrationIds.includes(first));
      await f.page.getByRole('button', { name: 'Apply reviewed changes', exact: true }).click();
      await f.page.getByText('Groups saved.', { exact: true }).waitFor();
      await f.page.getByRole('button', { name: 'Add group', exact: true }).click();
      await f.page.getByLabel('Group 8 name', { exact: true }).waitFor();
      await f.page.getByRole('button', { name: 'Discard draft', exact: true }).click();
      await f.page.getByRole('dialog').getByRole('button', { name: 'Discard draft', exact: true }).click();
      await f.page.getByRole('link', { name: 'Open reset & fresh draw options', exact: true }).click();
      await f.page.getByRole('button', { name: 'Reset All Groups & Fixtures', exact: true }).click();
      await f.page.getByText(/Recorded results exist/).waitFor();
      assert(!f.mutations.some(m => m.path.endsWith('/full-reset')));
      await f.page.getByRole('button', { name: 'Start Fresh Draw (Keep Results Safe)', exact: true }).click();
      await checkLayout(f.page, `${width} ${mode} restart preview`);
      await f.page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
      await f.page.getByRole('dialog').getByRole('textbox').fill(original.tournament.name);
      await f.page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
      await f.page.waitForURL('**/tournaments/fresh/groups');
      await f.page.getByRole('heading', { name: 'Group Manager', exact: true }).waitFor();
      await checkLayout(f.page, `${width} ${mode} fresh groups`);
      await f.page.screenshot({ path: `.cache/tournament-groups/${width}-${mode}.png`, fullPage: true });
      assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px ${mode}: balance, swap, rename, WebView fallback, guarded reset, typed safe restart and navigation`);
      passed++;
    } catch (error) {
      await f.page.screenshot({ path: `.cache/tournament-groups/failure-${width}-${mode}.png`, fullPage: true });
      console.log('Browser diagnostics', JSON.stringify(f.errors));
      throw error;
    } finally { await f.context.close(); }
  }
} finally { await browser.close(); }
console.log(`${passed} tournament editor viewport/theme scenarios passed.`);
