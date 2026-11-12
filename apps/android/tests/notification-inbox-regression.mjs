import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const output = process.env.FEEDBACK_SCREENSHOTS;
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });

try {
  for (const width of [320, 390, 768]) {
    const notifications = [
      { id: 'result', type: 'RESULT_SUBMITTED', title: 'Opponent submitted a result', message: 'Cup: 3-1 is waiting for verification.', href: '/matches/phase3', readAt: null },
      { id: 'stats', type: 'STATISTICS_UPDATED', title: 'Standings updated', message: 'Your points and statistics were updated.', href: '/tournaments/phase3/standings', readAt: null },
      { id: 'fixture', type: 'FIXTURE_CREATED', title: 'Fixtures ready', message: 'Your next fixture is ready.', href: '/tournaments/phase3/fixtures', readAt: null },
      { id: 'old', type: 'RESULT_CONFIRMED', title: 'Previous result confirmed', message: 'A previous match was confirmed.', href: '/matches/phase3', readAt: '2026-10-31T12:00:00Z' },
    ].map(n => ({ ...n, eventAt: '2026-11-01T12:00:00Z', entityId: null, entityType: null, createdAt: '2026-11-01T12:00:00Z' }));
    let failClear = false, delayRead = false, delayed, legacyResponse = false, resultPending = true;
    const resultTypes = ['RESULT_SUBMITTED', 'RESULT_CONFIRMED', 'RESULT_REJECTED', 'STATISTICS_UPDATED'];
    const { context, page, errors } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/notifications': async (route, headers) => {
        const query = new URL(route.request().url()).searchParams;
        const view = query.get('view');
        const unreadCount = notifications.filter(n => !n.readAt).length;
        const selected = view === 'pending-results' ? notifications.filter(n => n.id === 'result' && resultPending)
          : view === 'confirmed-results' ? notifications.filter(n => n.type === 'RESULT_CONFIRMED')
          : legacyResponse ? notifications : notifications.filter(n => view === 'history' ? n.readAt : !n.readAt)
          .filter(n => view !== 'results' || resultTypes.includes(n.type));
        const json = { success: true, data: query.has('summary') ? { unreadCount } : { unreadCount, notifications: selected.map(n => ({ ...n })) }, error: null };
        if (delayRead && view) {
          delayRead = false;
          return new Promise(resolve => { delayed = async () => { await route.fulfill({ headers, json }); resolve(); }; });
        }
        return route.fulfill({ headers, json });
      },
    }, onMutation: async (route, headers) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
      if (failClear) {
        failClear = false;
        return route.fulfill({ status: 500, headers, json: { success: false, data: null, error: { code: 'TEST_FAILURE', message: 'Unable to clear notification.' } } });
      }
      if (pathname === '/api/notifications/read-all') notifications.forEach(n => { n.readAt ??= new Date().toISOString(); });
      else {
        const match = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
        assert(match, `Unexpected mutation: ${pathname}`);
        notifications.find(n => n.id === match[1]).readAt = new Date().toISOString();
      }
      return route.fulfill({ headers, json: { success: true, data: {}, error: null } });
    } });
    try {
      await page.goto('https://fcarena.in/notifications');
      const cards = page.locator('section[aria-label$="notifications"] article');
      const waitForCards = (view, count) => page.waitForFunction(({ view, count }) =>
        document.querySelector(`section[aria-label="${view} notifications"]`)?.querySelectorAll('article').length === count,
      { view, count });
      await page.getByRole('button', { name: 'Inbox (3)', exact: true }).waitFor();
      assert.equal(await cards.count(), 3);
      assert.equal(await page.getByRole('link', { name: 'Previous result confirmed', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Results', exact: true }).click();
      await waitForCards('pending-results', 1);
      await page.getByText('Pending verification', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Standings updated', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Confirmed results', exact: true }).click();
      await waitForCards('confirmed-results', 1);
      await page.getByRole('link', { name: 'Previous result confirmed', exact: true }).waitFor();
      await page.getByRole('button', { name: 'All updates', exact: true }).click();
      await waitForCards('results', 2);
      await page.getByRole('link', { name: 'Opponent submitted a result', exact: true }).waitFor();
      assert.equal(await cards.count(), 2);
      assert.equal(await page.getByRole('link', { name: 'Fixtures ready', exact: true }).count(), 0);
      if (output) await page.screenshot({ path: path.join(output, `results-${width}.png`) });

      // Failed clears retain the row and badge; a successful retry removes it.
      failClear = true;
      await page.getByRole('button', { name: 'Clear Opponent submitted a result', exact: true }).click();
      await page.getByText('Unable to clear notification.', { exact: true }).waitFor();
      assert.equal(await cards.count(), 2);
      assert(await page.getByRole('button', { name: 'Inbox (3)', exact: true }).isVisible());

      // A refresh started before the clear must not restore the old row afterward.
      delayRead = true;
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-busy="true"]'));
      await page.getByRole('button', { name: 'Clear Opponent submitted a result', exact: true }).click();
      await page.getByRole('button', { name: 'Inbox (2)', exact: true }).waitFor();
      await waitForCards('results', 1);
      assert(delayed, 'refresh request was captured');
      await delayed();
      assert.equal(await page.getByRole('link', { name: 'Opponent submitted a result', exact: true }).count(), 0);
      await page.getByRole('link', { name: 'Notifications, 2 unread', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Pending results', exact: true }).click();
      await waitForCards('pending-results', 1);
      await page.getByRole('link', { name: 'Opponent submitted a result', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Mark read', exact: true }).count(), 0);

      await page.getByRole('button', { name: 'History', exact: true }).click();
      await waitForCards('history', 2);
      await page.getByRole('link', { name: 'Opponent submitted a result', exact: true }).waitFor();
      assert.equal(await cards.count(), 2);
      await page.reload();
      await page.getByRole('button', { name: 'Inbox (2)', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Opponent submitted a result', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Clear all', exact: true }).click();
      await page.getByRole('button', { name: 'Inbox (0)', exact: true }).waitFor();
      assert.equal(await cards.count(), 0);
      await page.getByRole('button', { name: 'History', exact: true }).click();
      await waitForCards('history', 4);
      await page.getByRole('link', { name: 'Fixtures ready', exact: true }).waitFor();
      assert.equal(await cards.count(), 4);
      legacyResponse = true;
      await page.reload();
      await page.getByRole('button', { name: 'Inbox (0)', exact: true }).waitFor();
      assert.equal(await cards.count(), 0, 'an older API returning all rows must not restore cleared notifications');
      await page.getByRole('button', { name: 'History', exact: true }).click();
      await waitForCards('history', 4);
      // Clearing alerts preserves the status lists; actual verification moves
      // a submission out of pending and adds its confirmation to that list.
      legacyResponse = false;
      notifications[0].readAt = null;
      notifications.push({ ...notifications[0], id: 'confirmed', type: 'RESULT_CONFIRMED', title: 'New result confirmed', readAt: null });
      await page.getByRole('button', { name: 'Results', exact: true }).click();
      await waitForCards('pending-results', 1);
      await page.getByRole('button', { name: 'Mark Opponent submitted a result as read', exact: true }).click();
      await page.getByRole('button', { name: 'Inbox (1)', exact: true }).waitFor();
      assert.equal(await cards.count(), 1, 'reading an alert must not remove pending verification work');
      await page.getByRole('button', { name: 'Clear all', exact: true }).click();
      await page.getByRole('button', { name: 'Inbox (0)', exact: true }).waitFor();
      assert.equal(await cards.count(), 1, 'clearing alerts must not remove pending verification work');
      resultPending = false;
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await page.getByText('No results pending verification', { exact: true }).waitFor();
      assert.equal(await cards.count(), 0);
      await page.getByRole('button', { name: 'Confirmed results', exact: true }).click();
      await waitForCards('confirmed-results', 2);
      await page.getByRole('link', { name: 'New result confirmed', exact: true }).waitFor();
      await checkLayout(page, `notification history ${width}px`);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: pending/confirmed results, verification transition, clear persistence, history, unread badge, failed clear and refresh race`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
