import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, user, career, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3102';
const baseline = process.env.BASELINE_ROLE === '1';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const ok = (r, h, data) => r.fulfill({ headers: h, json: { success: true, data, error: null } });
await mkdir('.cache/team-catalog', { recursive: true });
let passed = 0;
try {
  for (const width of baseline ? [1280] : [320, 390, 1280]) {
    let mode = 'SOLO', mine = null, saved = [], account = user.id;
    const memberships = [
      { membershipType: 'PRIMARY', adminRole: null, league: { id: 'tamil', name: 'FC ARENA TAMIL', code: 'TAMIL' } },
      { membershipType: 'SECONDARY', adminRole: 'ADMIN', league: { id: 'kickoff', name: 'KICKOFF FC', code: 'KICKOFF' } },
    ];
    const rows = Array.from({ length: 35 }, (_, i) => ({ id: `entry-${i}`, entryName: `Existing Team ${i}`, status: 'APPROVED', fixtureCount: 0, sortOrder: i, members: [] }));
    const cup = () => ({ ...tournament, name: 'International Friendlies', code: 'FCA-T-UE22UX', leagueId: 'kickoff', league: memberships[1].league, status: 'REGISTRATION_OPEN', maxEntries: 48, approvedEntries: 35, registeredEntries: 35, pendingEntries: 0, mode, teamSize: mode === 'SOLO' ? 1 : 2, isLeagueAdmin: true, canManageParticipants: true, canManageSettings: true });
    const f = await createUiContext(browser, { width, direct: true, native: width < 500, mode: 'DARK', role: 'USER', overrides: {
      '/api/auth/me': (r, h) => ok(r, h, { user: { ...user, id: account, role: 'USER' } }),
      '/api/leagues/my': (r, h) => ok(r, h, { leagues: account === user.id ? memberships : [memberships[0]] }),
      '/api/players/me/dashboard': (r, h) => ok(r, h, { career, memberships, tournaments: [cup()], fixtures: [] }),
      '/api/leagues/tamil/tournaments': { tournaments: [] },
      '/api/leagues/kickoff/tournaments': (r, h) => ok(r, h, { tournaments: [cup()] }),
      '/api/tournaments/phase3': (r, h) => ok(r, h, { tournament: cup() }),
      '/api/tournaments/phase3/entries': (r, h) => ok(r, h, { entries: rows }),
      '/api/tournaments/phase3/fixtures': { fixtures: [] },
      '/api/tournaments/phase3/my-registration': (r, h) => ok(r, h, { registration: mine, canEdit: true, canEditRoster: true }),
      '/api/tournaments/phase3/registrations': (r, h) => ok(r, h, { registrations: mine ? [mine] : [] }),
    }, onMutation: (r, h) => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/api/telemetry/web-vitals') return r.fulfill({ status: 204, headers: h });
      const data = r.request().postDataJSON();
      if (path === '/api/tournaments/phase3/register') {
        saved.push(data);
        mine = { id: 'my-entry', entryName: data.entryName, status: 'PENDING', createdAt: new Date().toISOString(), registeredBy: user, members: [{ user }] };
        return ok(r, h, { message: 'Registration submitted successfully' });
      }
      if (path === '/api/tournaments/phase3/entries') {
        saved.push(data); rows.push({ ...rows[0], id: 'new-admin-entry', entryName: data.entryName });
        return ok(r, h, { message: 'Team added' });
      }
      throw Error('Unexpected write: ' + path);
    } });
    const headerRole = () => f.page.locator('.fc-header-profile .theme-secondary-text');
    async function role(expected) {
      await f.page.waitForFunction(text => document.querySelector('.fc-header-profile .theme-secondary-text')?.textContent?.trim() === text, expected);
      assert.equal((await headerRole().textContent()).trim(), expected);
    }
    async function chooseClub(league, query, name) {
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await f.page.getByRole('combobox', { name: 'Football league', exact: true }).selectOption(league);
      assert.equal(await f.page.getByRole('combobox', { name: 'Football league' }).locator('option').count(), 51);
      await f.page.getByRole('searchbox', { name: 'Search clubs', exact: true }).fill(query);
      await f.page.getByRole('list', { name: 'Football team results' }).getByRole('button', { name: new RegExp('^' + name) }).click();
      assert.equal(await f.page.locator('input[name="entryName"]').inputValue(), name);
    }
    try {
      await f.page.goto(origin + '/dashboard');
      await f.page.getByRole('combobox', { name: 'Dashboard league context' }).selectOption('kickoff');
      await role('ADMIN');
      await f.page.getByRole('link', { name: 'Cup', exact: true }).click();
      await f.page.getByText('35 registered', { exact: true }).waitFor();
      if (baseline) {
        await role('Player');
        console.log('CONFIRMED screenshot bug: same KICKOFF FC cup has 35/48, but role changes from ADMIN on Home to Player on Cup.');
        continue;
      }
      await role('ADMIN');
      await f.page.getByRole('link', { name: 'View Details', exact: true }).click();
      await role('ADMIN');
      await f.page.getByRole('navigation', { name: 'Tournament sections' }).getByRole('link', { name: 'Teams', exact: true }).click();
      await f.page.getByRole('heading', { name: 'Existing Team 34', exact: true }).waitFor();
      await role('ADMIN');
      await f.page.goto(origin + '/tournaments/phase3/registration');
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).waitFor();
      await role('ADMIN');
      passed++; console.log(`PASS ${width}px role remains ADMIN through Home → Cup → overview → Teams → Registration; complete roster remains visible`);

      await chooseClub('ger.1', 'Bayern', 'Bayern Munich');
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await f.page.getByRole('searchbox', { name: 'Search clubs' }).fill('Real Madrid');
      assert.equal(await f.page.getByRole('list', { name: 'Football team results' }).getByRole('button').count(), 0);
      await f.page.getByRole('combobox', { name: 'Football league' }).selectOption('esp.1');
      await f.page.getByRole('searchbox', { name: 'Search clubs' }).fill('Real Madrid');
      await f.page.getByRole('list', { name: 'Football team results' }).getByRole('button', { name: /^Real Madrid/ }).click();
      await f.page.getByRole('button', { name: 'Submit for Admin Approval', exact: true }).click();
      await f.page.getByText('Registration submitted successfully', { exact: true }).waitFor();
      assert.equal(saved.length, 1); assert.equal(saved[0].entryName, 'Real Madrid'); assert.equal(saved[0].inGameName, user.player.identity.inGameName);
      passed++; console.log(`PASS ${width}px Bundesliga and La Liga stay separate; selected club is saved in the existing SOLO registration payload`);

      mine = null; mode = 'DUO';
      await f.page.goto(origin + '/tournaments/phase3/registration');
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await f.page.getByRole('button', { name: 'National teams', exact: true }).click();
      await f.page.getByRole('searchbox', { name: 'Search countries' }).fill('Belgium');
      await f.page.getByRole('list', { name: 'Football team results' }).getByRole('button', { name: /^Belgium/ }).click();
      assert.equal(await f.page.locator('input[name="entryName"]').inputValue(), 'Belgium');
      await f.page.locator('textarea').fill('P3\nP4');
      await f.page.getByRole('button', { name: 'Submit for Admin Approval', exact: true }).click();
      await f.page.getByText('Registration submitted successfully', { exact: true }).waitFor();
      assert.equal(saved.length, 2); assert.equal(saved[1].entryName, 'Belgium'); assert.deepEqual(saved[1].playerCodes, ['P3', 'P4']);
      passed++; console.log(`PASS ${width}px country selection saves correctly for a multi-player registration`);

      await f.page.goto(origin + '/tournaments/phase3/wizard/teams');
      await f.page.getByText('Admin Manual Entry — Optional', { exact: true }).click();
      await chooseClub('eng.1', 'Liverpool', 'Liverpool');
      await checkLayout(f.page, 'Football picker ' + width);
      await f.page.getByRole('button', { name: 'Add Team', exact: true }).click();
      await f.page.getByText('Team added successfully.', { exact: true }).waitFor();
      assert.equal(saved.length, 3); assert.equal(saved[2].entryName, 'Liverpool');
      assert.equal(await f.page.locator('input[name="entryName"]').inputValue(), '', 'native form reset must clear the chosen name');
      await f.page.locator('input[name="entryName"]').fill('My Custom Club');
      assert.equal(await f.page.locator('input[name="entryName"]').inputValue(), 'My Custom Club');
      passed++; console.log(`PASS ${width}px admin manual entry uses the same club picker and resets safely; custom names remain editable`);

      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await f.page.getByRole('button', { name: 'National teams', exact: true }).click();
      await f.page.getByRole('searchbox', { name: 'Search countries' }).fill('');
      while (await f.page.getByRole('button', { name: 'Show more teams', exact: true }).count()) {
        await f.page.getByRole('button', { name: 'Show more teams', exact: true }).click();
      }
      assert.equal(await f.page.getByRole('list', { name: 'Football team results' }).getByRole('button').count(), 211);
      await f.page.getByRole('searchbox', { name: 'Search countries' }).fill('India');
      await f.page.getByRole('searchbox', { name: 'Search countries' }).press('Enter');
      assert.equal(saved.length, 3, 'search Enter must not submit the registration form');
      await checkLayout(f.page, 'National team picker ' + width);
      await f.page.getByRole('group', { name: 'Football team choices' }).screenshot({ path: `.cache/team-catalog/picker-${width}.png` });
      await f.page.getByRole('searchbox', { name: 'Search countries' }).press('Escape');
      assert.equal(await f.page.getByRole('group', { name: 'Football team choices' }).count(), 0);
      assert.equal(await f.page.locator('input[name="entryName"]').inputValue(), 'My Custom Club');
      passed++; console.log(`PASS ${width}px all 211 countries are reachable, search Enter never submits and Escape preserves the draft`);
      account = 'other-account';
      await f.page.goto(origin + '/tournaments'); await role('Player');
      assert.equal(await f.page.getByText('35 registered', { exact: true }).count(), 0);
      assert.deepEqual(f.errors, []);
      passed++; console.log(`PASS ${width}px another account cannot inherit the admin role or selected league`);
    } finally { await f.context.close(); }
  }
  console.log(JSON.stringify({ passed, baseline }));
} finally { await browser.close(); }
