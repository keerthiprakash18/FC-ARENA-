// Rendered acceptance against synthetic API fixtures; never uses production data.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, career } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-mobile-ui';
mkdirSync(output, { recursive: true });
const themes = ['LUXURY_GOLD','CLASSIC_BLUE','CITY_SKY','LONDON_RED','MERSEY_RED','MADRID_ROYAL','CATALAN_NIGHTS','MUNICH_RED','PARIS_NIGHT','MILAN_BLUE','MILAN_RED','TURIN_MONO'];
const overview = { ...phaseData['/api/admin/ops/overview'], trend: { label: 'New players', days: [
  { day: '2026-11-23', newPlayers: 10, confirmedResults: 10 },
  { day: '2026-11-24', newPlayers: 5, confirmedResults: 0 },
  { day: '2026-11-25', newPlayers: 0, confirmedResults: 2 },
]} };
const activity = { daily: 2, weekly: 7, signups: 6, day1Eligible: 4, day1Returned: 2, day7Eligible: 0, day7Returned: 0, inviteApplications: 3, inviteApprovals: 1 };
const populatedCareer = { ...career, profile: { ...career.profile, primaryLeague: { league: { id: 'phase3', name: 'First League' } }, secondaryLeague: { league: { id: 'second', name: 'Second League' } } } };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
let count = 0;
try {
  for (const theme of themes) for (const mode of ['LIGHT','DARK']) {
    const f = await createUiContext(browser, { width: 390, native: true, direct: true, theme, mode,
      overrides: { '/api/players/me/career': populatedCareer, '/api/admin/ops/overview': overview, '/api/admin/ops/player-activity': activity } });
    try {
      await f.page.goto(origin + '/career');
      const identity = f.page.locator('.fc-career-identity');
      await identity.getByRole('link', { name: 'First League', exact: true }).waitFor();
      for (const [name, href] of [['First League','/leagues/phase3'],['Second League','/leagues/second']]) {
        const link = identity.getByRole('link', { name, exact: true });
        assert.equal(await link.getAttribute('href'), href);
        const result = await link.evaluate(el => {
          const css = getComputedStyle(el);
          const rgb = v => (v.match(/[\d.]+/g) || []).map(Number);
          const luma = channels => channels.slice(0,3).reduce((sum,x,i) => sum + (x/255 <= .04045 ? x/255/12.92 : ((x/255+.055)/1.055)**2.4)*[.2126,.7152,.0722][i],0);
          const fg = luma(rgb(css.color)), bg = luma(rgb(css.backgroundColor));
          return { contrast: (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05), height: el.getBoundingClientRect().height };
        });
        assert(result.height >= 44, name + ': touch target');
        assert(result.contrast >= 4.5, `${theme} ${mode} ${name}: contrast ${result.contrast}`);
      }
      const goals=f.page.getByRole('region',{name:'Goal balance'});
      for (const [label,value] of [['Goals scored',6],['Goals conceded',4]]) {
        const meter=goals.getByRole('meter',{name:label+': '+value});
        assert.equal(await meter.getAttribute('value'),String(value));
        assert.equal(await meter.getAttribute('max'),'6');
      }
      assert(await goals.getByText('+2',{exact:true}).isVisible());
      await checkLayout(f.page, `Career leagues ${theme} ${mode}`);
      await f.page.goto(origin + '/admin/analytics');
      const chart = f.page.locator('.premium-activity-chart');
      await chart.waitFor();
      const bars = await chart.locator('[data-series]').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
      assert.equal(bars.length, 6);
      assert(bars[0] > 0 && Math.abs(bars[0]-bars[1]) < 1, 'Equal values have equal bar heights');
      assert(Math.abs(bars[2]*2-bars[0]) < 1 && bars[3] === 0 && bars[4] === 0, 'Half and zero values retain exact scale');
      assert(Math.abs(bars[5]*5-bars[0]) < 2, 'Second series uses the same scale');
      const details = f.page.locator('details').filter({ hasText: 'View activity data' });
      await details.locator('summary').click();
      const table = details.getByRole('table', { name: 'Verified activity by day' });
      await table.waitFor();
      const first = table.getByRole('row').nth(1);
      assert.equal(await first.getByRole('cell').allTextContents().then(a => a.join(',')), '10,10');
      assert.equal(await table.getByRole('rowheader', { name: '2026-11-24' }).count(), 1);
      await f.page.getByText('Day 1 retention', { exact: true }).waitFor();
      assert(await f.page.getByText('50% (2/4)', { exact: true }).isVisible());
      await checkLayout(f.page, `Analytics ${theme} ${mode}`);
      if (theme === 'LUXURY_GOLD') await f.page.screenshot({ path: join(output, `admin-analytics-390-${mode.toLowerCase()}.png`), fullPage: true, animations: 'disabled' });
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.mutations, []);
      count += 2;
    } finally { await f.context.close(); }
  }
  for (const width of [320,1280]) {
    let fail = true;
    const f = await createUiContext(browser, { width, direct: true, mode: 'LIGHT', overrides: {
      '/api/admin/ops/overview': (route, headers) => fail
        ? route.fulfill({ status: 503, headers, json: { success: false, data: null, error: { message: 'Analytics temporarily unavailable' } } })
        : route.fulfill({ headers, json: { success: true, data: overview, error: null } }),
      '/api/admin/ops/player-activity': activity,
    } });
    try {
      await f.page.goto(origin + '/admin/analytics');
      await f.page.getByRole('alert').getByText('Analytics unavailable', { exact: true }).waitFor();
      fail = false;
      await f.page.getByRole('button', { name: 'Retry analytics' }).click();
      await f.page.getByRole('heading', { name: 'Verified Activity' }).waitFor();
      await checkLayout(f.page, `Admin analytics recovery ${width}`);
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.mutations, []);
      count++;
    } finally { await f.context.close(); }
  }
  console.log(`PASS admin and career acceptance: ${count} theme/layout/recovery cases`);
} finally { await browser.close(); }
