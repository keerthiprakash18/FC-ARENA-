import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, user } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';
import { makeFixtureFeed } from './fixture-feed-fixtures.mjs';

const crest = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36"><path fill="#e5b348" d="M2 2h28v22L16 34 2 24z"/></svg>')}`;
const output = process.env.OPPONENT_SCREENSHOTS;
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const opponent = { id: 'opponent', fullName: 'Ravi Kumar', inGameName: 'Ravi FC', playerCode: 'FCA-OPP-001' };
    const away = { id: 'away', entryName: 'Opponent Club', entryLogoUrl: crest, members: [opponent] };
    const fixture = { ...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0], group: null,
      home: { id: 'home', entryName: 'Home Club', entryLogoUrl: crest,
        members: [{ id: user.id, fullName: 'Home Captain', inGameName: 'Captain FC', playerCode: 'FCA-HOME-001' }] }, away };
    const { context, page, errors, mutations } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/leagues/phase3/fixture-feed': route => route.fulfill({ json: { success: true, error: null,
        data: makeFixtureFeed('phase3', phaseData['/api/leagues/phase3/tournaments'].tournaments, { phase3: [fixture] }) } }),
      '/api/tournaments/phase3/fixtures': route => route.fulfill({ json: { success: true,
        data: { ...phaseData['/api/tournaments/phase3/fixtures'], fixtures: [fixture] }, error: null } }),
    }, onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    } });
    for (const url of ['/fixtures', '/tournaments/phase3/fixtures']) {
      fixture.away = away;
      away.members = [opponent];
      await page.goto(`https://fcarena.in${url}`);
      const trigger = page.getByRole('button', { name: 'View players representing Opponent Club', exact: true });
      await trigger.locator('img').click();
      const dialog = page.getByRole('dialog', { name: 'Opponent Club — Players', exact: true });
      await dialog.waitFor();
      await dialog.getByText('Ravi Kumar', { exact: true }).waitFor();
      await dialog.getByText('Account name', { exact: true }).waitFor();
      await dialog.getByText('Team / Club: Opponent Club', { exact: true }).waitFor();
      assert((await dialog.innerText()).includes('In-game name: Ravi FC'));
      assert((await dialog.innerText()).includes('Player ID: FCA-OPP-001'));
      assert(!(await dialog.innerText()).includes('Home Captain'));
      assert.equal(new URL(page.url()).pathname, url, 'opening a team must not navigate to the match');
      assert.equal(await page.locator('a button').count(), 0, 'team buttons must not be nested in match links');
      await checkLayout(page, `opponent details ${url} ${width}`);
      if (output && url === '/fixtures') await page.screenshot({ path: path.join(output, `opponent-${width}.png`) });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
      await page.getByRole('button', { name: 'View players representing Home Club', exact: true }).focus();
      await page.keyboard.press('Enter');
      const homeDialog = page.getByRole('dialog', { name: 'Home Club — Players', exact: true });
      await homeDialog.getByText('Home Captain', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await homeDialog.waitFor({ state: 'hidden' });

      away.members.push({ id: 'opponent-two', fullName: 'Second Player', inGameName: 'Duo FC', playerCode: 'FCA-OPP-002' });
      await page.reload();
      await trigger.click();
      await dialog.getByText('Second Player', { exact: true }).waitFor();
      assert.equal(await dialog.locator('li').count(), 2);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    }
    away.members = [];
    await page.goto('https://fcarena.in/fixtures');
    await page.getByRole('button', { name: 'View players representing Opponent Club', exact: true }).click();
    await page.getByRole('dialog').getByText('No player account is linked to this team yet. Ask the tournament admin to link the player.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').locator('li').count(), 0);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    fixture.away = null;
    await page.reload();
    await page.getByRole('button', { name: 'View players representing Home Club', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'View players representing TBD', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    assert(mutations.every(mutation => mutation.path === '/api/telemetry/web-vitals'));
    await context.close();
    console.log(`PASS ${width}px: team logo/name opens correct player(s), keyboard/escape/close restore focus, missing links/TBD handled, match links preserved`);
  }
} finally { await browser.close(); }
