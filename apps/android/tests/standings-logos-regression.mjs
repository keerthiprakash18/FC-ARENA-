import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament as baseTournament } from './phase-ui-fixtures.mjs';

const crest = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36"><path fill="${color}" d="M2 2h28v22L16 34 2 24z"/></svg>`)}`;
const logos = [crest('#e0b452'), crest('#28a4ed'), null];
const rows = logos.map((entryLogoUrl, index) => ({
  position: index + 1, registrationId: `club-${index}`, entryName: ['First Club', 'Second Club', 'Without Logo'][index],
  entryLogoUrl, played: 2, wins: 2 - index, draws: 0, losses: index,
  goalsFor: 4 - index, goalsAgainst: index, goalDifference: 4 - index * 2, points: 6 - index * 3, form: 'WW',
}));
const output = process.env.STANDINGS_LOGO_SCREENSHOTS;
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 768, 1280]) {
    for (const grouped of [false, true]) {
      const tournament = { ...baseTournament, name: 'Club Logos Cup', competitionFormat: grouped ? 'GROUP_STAGE_KNOCKOUT' : 'UCL_CUP' };
      // Group entries intentionally omit logos: standings must carry their own logo.
      const groups = grouped ? [{ id: 'group', name: 'Group A', position: 1,
        entries: rows.map(row => ({ id: row.registrationId, entryName: row.entryName, members: [] })) }] : [];
      const publicRows = rows.map(row => ({ ...row, name: row.entryName, logoUrl: row.entryLogoUrl }));
      const { context, page, errors, mutations } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
        '/api/tournaments/phase3/standings': { tournament, standings: rows },
        '/api/tournaments/phase3/groups': { tournament, groups, unassigned: [] },
        '/api/tournaments/phase3/rankings': { ...phaseData['/api/tournaments/phase3/rankings'],
          categories: { ...phaseData['/api/tournaments/phase3/rankings'].categories,
            bestTeams: { available: true, reason: null, entries: publicRows } } },
        '/api/public/tournaments/PHASE3': { ...phaseData['/api/public/tournaments/PHASE3'], tournament,
          groups: [], standings: publicRows },
      }, onMutation: (route, headers) => {
        assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
        return route.fulfill({ status: 204, headers });
      } });
      for (const route of ['standings', 'public', 'rankings']) {
        await page.goto(route === 'public' ? 'https://fcarena.in/public/tournaments/PHASE3' : `https://fcarena.in/tournaments/phase3/${route}`);
        if (route === 'rankings') await page.getByRole('button', { name: 'Best Teams', exact: true }).click();
        const table = page.locator(route === 'public' ? '#standings table:visible' : route === 'standings' ? '.premium-standings-table table:visible' : 'section:has(.fc-compact-standings) table:visible');
        await table.waitFor();
        const teamRows = table.locator(width < 640 ? '.fc-compact-team-row' : 'tbody tr');
        assert.equal(await teamRows.count(), 3);
        for (let index = 0; index < 3; index++) {
          const row = teamRows.nth(index), image = row.locator('.premium-crest img');
          assert((await row.innerText()).includes(rows[index].entryName));
          if (logos[index]) {
            await image.scrollIntoViewIfNeeded();
            await image.evaluate(img => img.decode());
            assert.equal(await image.getAttribute('src'), logos[index], 'the correct club logo stays with its registered entry');
            assert(await image.evaluate(img => img.complete && img.naturalWidth > 0), 'club logo is loaded');
          } else {
            assert.equal(await image.count(), 0);
            assert.equal(await row.locator('.premium-crest').innerText(), 'WL');
          }
        }
        await checkLayout(page, `${route} logos ${width} ${grouped}`);
        if (output && !grouped && route === 'standings') {
          await table.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, `overall-${width}.png`) });
        }
      }
      assert.deepEqual(errors, []);
      assert(mutations.every(mutation => mutation.path === '/api/telemetry/web-vitals'));
      await context.close();
      console.log(`PASS ${width}px ${grouped ? 'grouped' : 'overall'}: registered logos on standings, public table and team rankings; no-logo fallback retained`);
    }
  }
} finally { await browser.close(); }
