import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const width of [320, 390, 768]) {
    const old = { id: 'old-player', fullName: 'Original Player', player: { playerCode: 'FCA-OLD', identity: { inGameName: 'Original Player' } } };
    const incoming = { id: 'new-player', fullName: 'Replacement Player', player: { playerCode: 'FCA-NEW', identity: { inGameName: 'Replacement Player' } } };
    const entry = { id: 'entry-1', entryName: 'Home team', entryLogoUrl: null, groupId: 'group-1', fixtureCount: 8, status: 'APPROVED', members: [{ user: old }] };
    let canManage = true, status = 'ACTIVE', writes = 0, rejectWrite = true;
    const f = await createUiContext(browser, { width, overrides: {
      '/api/tournaments/phase3': () => { throw Error('Use route override below'); },
      '/api/tournaments/phase3/entries': (route, headers) => route.fulfill({ headers, json: { success: true, data: { maxEntries: 42, entries: [entry] }, error: null } }),
    }, onMutation: async (route, headers) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = route.request().postDataJSON();
      if (pathname === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
      const fail = message => route.fulfill({ status: 409, headers, json: { success: false, data: null, error: { code: 'CONFLICT', message } } });
      if (pathname.endsWith('/replacement-preview')) {
        if (body.replacementPlayerCode !== 'FCA-NEW') return fail('FC ARENA Player ID could not be found.');
        return route.fulfill({ headers, json: { success: true, data: { entry: { id: entry.id, name: entry.entryName, groupName: 'Group A' }, outgoing: { id: old.id, name: old.fullName, playerCode: 'FCA-OLD' }, replacement: { id: incoming.id, name: incoming.fullName, playerCode: 'FCA-NEW' }, fixtureCount: 8, confirmedMatchCount: 3 }, error: null } });
      }
      assert(pathname.endsWith('/replace-player'), pathname);
      writes++;
      if (rejectWrite) { rejectWrite = false; return fail('Another admin changed this entry. Preview again.'); }
      assert.equal(body.outgoingUserId, old.id);
      assert.equal(body.replacementPlayerCode, 'FCA-NEW');
      entry.members = [{ user: incoming }];
      return route.fulfill({ headers, json: { success: true, data: { message: 'Player replaced successfully. Fixtures and results preserved.' }, error: null } });
    } });
    // Install this route after the shared harness so the current permissions
    // can be changed between the admin and ordinary-player checks.
    await f.context.route('**/api/tournaments/phase3', (route) => route.fulfill({ json: { success: true, data: { tournament: { ...tournament, maxEntries: 42, status, canManageParticipants: canManage, canManageAdmins: false } }, error: null } }));
    async function openTeam() {
      await f.page.getByRole('heading', { name: 'Home team', exact: true }).waitFor();
      if (width < 768) await f.page.getByRole('button', { name: 'Players & details ↓', exact: true }).click();
    }
    try {
      await f.page.goto('https://fcarena.in/tournaments/phase3/teams');
      await openTeam();
      await f.page.getByRole('button', { name: 'Replace player', exact: true }).click();
      const dialog = f.page.getByRole('dialog', { name: 'Replace tournament player', exact: true });
      await dialog.getByLabel('Replacement FC ARENA Player ID').fill('MISSING');
      await dialog.getByRole('button', { name: 'Preview replacement', exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'could not be found' }).waitFor();
      assert.equal(writes, 0);
      await dialog.getByLabel('Replacement FC ARENA Player ID').fill('FCA-NEW');
      await dialog.getByRole('button', { name: 'Preview replacement', exact: true }).click();
      await dialog.getByText('8 fixtures kept', { exact: false }).waitFor();
      await checkLayout(f.page, `replacement preview ${width}`);
      await dialog.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'Another admin' }).waitFor();
      assert.equal(entry.members[0].user.id, old.id);
      await dialog.getByRole('button', { name: 'Preview replacement', exact: true }).click();
      await dialog.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
      await f.page.getByRole('link', { name: 'Replacement Player', exact: false }).waitFor();
      assert.equal(writes, 2);
      assert.equal(entry.fixtureCount, 8);
      assert.equal(entry.groupId, 'group-1');
      await f.page.reload(); await openTeam();
      await f.page.getByRole('link', { name: 'Replacement Player', exact: false }).waitFor();
      canManage = false;
      await f.page.reload(); await openTeam();
      assert.equal(await f.page.getByRole('button', { name: 'Replace player', exact: true }).count(), 0);
      canManage = true; status = 'COMPLETED';
      await f.page.reload(); await openTeam();
      assert.equal(await f.page.getByRole('button', { name: 'Replace player', exact: true }).count(), 0);
      await checkLayout(f.page, `replacement teams ${width}`);
      assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px: preview, invalid ID, concurrent edit recovery, replacement persistence, permissions, completed lock, layout`);
    } finally { await f.context.close(); }
  }
} finally { await browser.close(); }
