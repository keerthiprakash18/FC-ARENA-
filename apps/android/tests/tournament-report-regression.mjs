import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';
import { report as sample } from './tournament-report-fixture.mjs';
const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3102';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const report = structuredClone(sample); report.tournament.id = 'phase3';
const entries = Array.from({ length: 36 }, (_, i) => ({ id: 'entry-' + i, entryName: i ? 'Football Team ' + i : 'தமிழ் வீரர்கள்', entryLogoUrl: null, status: 'APPROVED', fixtureCount: 3, members: [{ user: { id: 'player-' + i, fullName: 'Player ' + i, player: { playerCode: 'FC-' + i, identity: { inGameName: 'Captain ' + i } } } }] }));
let passed = 0;
await mkdir('.cache/tournament-report', { recursive: true });
try {
  for (const width of [320, 390, 1280]) {
    const f = await createUiContext(browser, { width, direct: true, native: width < 700, mode: width === 390 ? 'LIGHT' : 'DARK', overrides: {
      '/api/tournaments/phase3': { tournament: { ...tournament, status: 'COMPLETED', canManageAdmins: false, canManageParticipants: false } },
      '/api/tournaments/phase3/report': { report }, '/api/tournaments/phase3/entries': { entries },
    }, onMutation: (r, h) => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/api/telemetry/web-vitals') return r.fulfill({ status: 204, headers: h });
      assert.equal(path, '/api/tournaments/phase3/report/exports');
      const data = r.request().postDataJSON(); assert(['pdf', 'png'].includes(data.format)); assert(['full', 'teams'].includes(data.kind));
      return r.fulfill({ headers: h, json: { success: true, data: { path: '/tournament-report-exports/10000000-0000-4000-8000-000000000001?grant=test.signature', filename: `FC-ARENA-test-${data.kind}.${data.format}`, expiresAt: new Date(Date.now() + 300000).toISOString() } } });
    } });
    try {
      await f.page.goto(origin + '/tournaments/phase3/report');
      await f.page.getByRole('heading', { name: 'The final podium', exact: true }).waitFor();
      assert.equal(await f.page.locator('[aria-label="Full tournament report"] h1').evaluate(el => getComputedStyle(el).color), 'rgb(239, 244, 248)', 'Cover title stays readable in every theme');
      assert.equal(await f.page.getByRole('heading', { name: 'The final podium', exact: true }).evaluate(el => getComputedStyle(el).color), 'rgb(13, 34, 52)', 'Paper sections retain dark headings in every theme');
      await checkLayout(f.page, 'Full report ' + width);
      await f.page.getByRole('button', { name: 'Export full PDF', exact: true }).click();
      const pdf = f.page.getByRole('link', { name: 'Download PDF', exact: true }); await pdf.waitFor();
      assert.match(await pdf.getAttribute('href'), /\/api\/tournament-report-exports\/.*grant=/); assert(!(await pdf.getAttribute('href')).startsWith('blob:'));
      await f.page.getByRole('button', { name: 'Export cover PNG', exact: true }).click(); await f.page.getByRole('link', { name: 'Download PNG', exact: true }).waitFor();
      await f.page.locator('[aria-label="Full tournament report"]').screenshot({ path: `.cache/tournament-report/preview-${width}.png` });
      passed++; console.log(`PASS ${width}px completed report content, layout and explicit mobile-safe PDF/PNG download links`);
      await f.page.goto(origin + '/tournaments/phase3/teams');
      const teams = f.page.getByRole('region', { name: 'Tournament teams' });
      await f.page.getByRole('heading', { name: 'Football Team 35', exact: true }).waitFor();
      if (width < 700) {
        const buttons = f.page.getByRole('button', { name: 'Players & details ↓', exact: true }); assert.equal(await buttons.count(), 36);
        const boxes = await buttons.evaluateAll(nodes => nodes.slice(0, 2).map(n => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y, bottom: n.closest('.fc-panel').getBoundingClientRect().bottom, top: n.closest('.fc-panel').getBoundingClientRect().top })));
        assert(boxes[1].x > boxes[0].x); assert(Math.abs(boxes[0].y - boxes[1].y) < 40); assert(boxes[0].bottom - boxes[0].top < 240);
        assert.equal(await f.page.getByRole('link', { name: 'Captain 0 FC-0', exact: true }).count(), 0);
        await buttons.first().click(); await f.page.getByRole('link', { name: 'Captain 0 FC-0', exact: true }).waitFor();
        await f.page.getByRole('button', { name: 'Close details ↑', exact: true }).click();
      } else { await f.page.getByRole('link', { name: 'Captain 0 FC-0', exact: true }).waitFor(); }
      await f.page.getByRole('searchbox', { name: 'Find a team or player' }).fill('FC-35');
      await f.page.getByText('1 of 36 teams · Open a card for players and actions', { exact: true }).waitFor();
      await f.page.getByRole('button', { name: 'Export PDF', exact: true }).click(); await f.page.getByRole('link', { name: 'Download PDF ↓', exact: true }).waitFor();
      assert.equal(f.mutations.filter(m => m.path.endsWith('/report/exports')).at(-1).body, JSON.stringify({ format: 'pdf', kind: 'teams' }));
      await f.page.getByRole('searchbox', { name: 'Find a team or player' }).fill(''); await checkLayout(f.page, 'Compact team list ' + width);
      await f.page.screenshot({ path: `.cache/tournament-report/teams-${width}.png` });
      assert.deepEqual(f.errors, []); passed++; console.log(`PASS ${width}px full 36-team list, mobile two-column compact cards, accessible details, player search and complete roster export`);
      void teams;
    } finally { await f.context.close(); }
  }
  for (const status of ['REGISTRATION_OPEN', 'ACTIVE']) {
    let reads = 0;
    const f = await createUiContext(browser, { width: 390, direct: true, native: true, overrides: { '/api/tournaments/phase3': { tournament: { ...tournament, status, canManageAdmins: false, canManageParticipants: false } }, '/api/tournaments/phase3/entries': { entries }, '/api/tournaments/phase3/report': () => { reads++; throw Error('Incomplete report must not be loaded'); } }, onMutation: (r, h) => r.fulfill({ status: 204, headers: h }) });
    try { await f.page.goto(origin + '/tournaments/phase3/report'); await f.page.getByText('Full report unlocks on completion', { exact: true }).waitFor(); assert.equal(reads, 0);
      await f.page.goto(origin + '/tournaments/phase3/teams'); await f.page.getByRole('button', { name: 'Export PDF', exact: true }).waitFor(); assert.equal(await f.page.getByRole('button', { name: 'Export PDF', exact: true }).isEnabled(), true); passed++; console.log(`PASS ${status}: team list export stays available while final recap remains locked`);
    } finally { await f.context.close(); }
  }
  console.log(JSON.stringify({ passed }));
} finally { await browser.close(); }
