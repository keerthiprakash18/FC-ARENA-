import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, user, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';
const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3102';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const ok = (r, h, data) => r.fulfill({ headers: h, json: { success: true, data, error: null } });
await mkdir('.cache/chosen-teams', { recursive: true });
let passed = 0;
try {
  for (const width of [320, 390, 1280]) {
    let mine = null, unavailable = false, admin = false, writes = 0;
    const rows = [
      { id: 'belgium', entryName: '  BELGIUM  ', status: 'PENDING', fixtureCount: 0, sortOrder: 0, members: [] },
      { id: 'bayern', entryName: 'Bayern Munich', status: 'APPROVED', fixtureCount: 0, sortOrder: 1, members: [] },
      { id: 'japan', entryName: 'Japan', status: 'WITHDRAWN', fixtureCount: 0, sortOrder: 2, members: [] },
    ];
    const cup = () => ({ ...tournament, status: 'REGISTRATION_OPEN', registrationMode: 'APPROVAL', isLeagueAdmin: admin, canManageParticipants: admin, canManageSettings: admin });
    const f = await createUiContext(browser, { width, direct: true, native: width < 500, role: 'USER', mode: 'DARK', overrides: {
      '/api/tournaments/phase3': (r, h) => ok(r, h, { tournament: cup() }),
      '/api/tournaments/phase3/entries': (r, h) => unavailable
        ? r.fulfill({ status: 503, headers: h, json: { success: false, data: null, error: { code: 'TEMPORARY', message: 'Temporary connection failure' } } })
        : ok(r, h, { entries: rows }),
      '/api/tournaments/phase3/registrations': { registrations: [] },
      '/api/tournaments/phase3/fixtures': { fixtures: [] },
      '/api/tournaments/phase3/my-registration': (r, h) => ok(r, h, { registration: mine, canEdit: true, canEditRoster: true }),
    }, onMutation: (r, h) => {
      if (new URL(r.request().url()).pathname === '/api/telemetry/web-vitals') return r.fulfill({ status: 204, headers: h });
      writes++; return r.fulfill({ status: 409, headers: h, json: { success: false, data: null, error: { code: 'ENTRY_NAME_ALREADY_EXISTS', message: 'Already chosen' } } });
    } });
    const results = () => f.page.getByRole('list', { name: 'Football team results' });
    async function countries(query) {
      await f.page.getByRole('button', { name: 'National teams', exact: true }).click();
      await f.page.getByRole('searchbox', { name: 'Search countries' }).fill(query);
    }
    async function chosen(name, expected = true) {
      const button = results().getByRole('button', { name: new RegExp('^' + name) });
      await button.waitFor();
      await f.page.waitForFunction(({ name, expected }) => [...document.querySelectorAll('ul[aria-label="Football team results"] button')].some(button => button.textContent.startsWith(name) && button.disabled === expected), { name, expected });
      assert.equal(await button.isDisabled(), expected);
      assert.equal(await button.getByText('Already chosen', { exact: true }).count(), expected ? 1 : 0);
      return button;
    }
    try {
      await f.page.goto(origin + '/tournaments/phase3/registration');
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await countries('Belgium'); await chosen('Belgium');
      await f.page.getByRole('button', { name: 'Clubs', exact: true }).click();
      await f.page.getByRole('combobox', { name: 'Football league' }).selectOption('ger.1');
      await f.page.getByRole('searchbox', { name: 'Search clubs' }).fill('Bayern'); await chosen('Bayern Munich');
      await checkLayout(f.page, 'Already chosen ' + width);
      await f.page.getByRole('group', { name: 'Football team choices' }).screenshot({ path: `.cache/chosen-teams/clubs-${width}.png` });
      passed++; console.log(`PASS ${width}px pending countries and approved clubs display Already chosen and are disabled for ordinary players`);

      await f.page.getByRole('button', { name: 'Close team choices', exact: true }).click();
      await f.page.locator('input[name="entryName"]').fill('　ＢＥＬＧＩＵＭ  ');
      await f.page.getByText('Already chosen in this tournament. Choose another team.', { exact: true }).waitFor();
      assert.equal(await f.page.locator('input[name="entryName"]').evaluate(input => input.validity.customError), true);
      await f.page.getByRole('button', { name: 'Submit for Admin Approval', exact: true }).click();
      assert.equal(writes, 0, 'typing a normalized duplicate must not submit');
      await f.page.locator('input[name="entryName"]').fill('My New Club');
      assert.equal(await f.page.locator('input[name="entryName"]').evaluate(input => input.checkValidity()), true);
      passed++; console.log(`PASS ${width}px manually typed case/Unicode variants are blocked before submission; custom distinct names stay valid`);

      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await countries('Japan'); await chosen('Japan', false);
      rows[2].status = 'PENDING'; await f.page.evaluate(() => window.dispatchEvent(new Event('focus'))); await chosen('Japan');
      rows[0].status = 'REJECTED'; await f.page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await countries('Belgium'); await chosen('Belgium', false);
      passed++; console.log(`PASS ${width}px another player's new pending choice appears on refresh and a rejected choice becomes available again`);

      unavailable = true; await f.page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await f.page.getByRole('button', { name: 'Retry chosen teams', exact: true }).waitFor();
      assert.equal(await results().getByRole('button').first().isDisabled(), true);
      unavailable = false; await f.page.getByRole('button', { name: 'Retry chosen teams', exact: true }).click();
      await chosen('Belgium', false); assert.equal(writes, 0);
      passed++; console.log(`PASS ${width}px failed availability read never advertises a team as available and retries without a write`);

      rows[0].status = 'PENDING'; mine = { ...rows[0], registeredBy: user, members: [{ user }], createdAt: new Date().toISOString() };
      await f.page.goto(origin + '/tournaments/phase3/registration');
      await f.page.getByRole('button', { name: 'Edit Your Team', exact: true }).click();
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await countries('Belgium'); await chosen('Belgium', false);
      await countries('Japan'); await chosen('Japan');
      passed++; console.log(`PASS ${width}px editing one's registration allows its own team but reserves every other active team`);

      admin = true;
      await f.page.goto(origin + '/tournaments/phase3/wizard/teams');
      await f.page.getByText('Admin Manual Entry — Optional', { exact: true }).click();
      await f.page.getByRole('button', { name: 'Choose football team', exact: true }).click();
      await countries('Belgium'); await chosen('Belgium');
      assert.deepEqual(f.errors, []); assert.equal(writes, 0);
      passed++; console.log(`PASS ${width}px the same availability rule applies to admin manual entry`);
    } finally { await f.context.close(); }
  }
  console.log(JSON.stringify({ passed }));
} finally { await browser.close(); }
