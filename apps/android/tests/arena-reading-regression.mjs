// Synthetic community fixtures only. Never read or mutate a production account.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '.cache/arena-reading';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const leagueId = 'reading-league';
const contextData = {
  leagues: [{ id: leagueId, name: 'Coastal Premier League', subscribed: true }],
  canModerate: false, mutedPlayers: [],
  policy: { audienceNote: 'League conversations stay within the league. Posts and likes do not earn XP.' },
};
function post(privateRoom = false) {
  return {
    id: privateRoom ? 'league-post' : 'public-post', kind: 'DISCUSSION',
    body: privateRoom ? 'Private matchday discussion' : 'Who controls the midfield this weekend?',
    sourceUrl: null, imageUrl: null, createdAt: '2026-11-25T12:00:00Z', editedAt: null,
    audience: privateRoom ? 'LEAGUE' : 'PUBLIC',
    league: privateRoom ? { id: leagueId, name: 'Coastal Premier League' } : null,
    author: { id: 'opponent', name: 'Coastal Captain', inGameName: 'CoastalCaptain', playerCode: 'FC1024', avatarUrl: null, verified: true },
    liked: false, reactionCount: 3, commentCount: 0, canEdit: false, canDelete: false, canReport: true,
    result: null, poll: null,
  };
}

try {
  for (const width of [320, 390, 1280]) for (const mode of ['LIGHT', 'DARK']) {
    let failRefresh = false;
    const fixture = await createUiContext(browser, { width, mode, direct: true, overrides: {
      '/api/arena-talk/context': contextData,
      '/api/arena-talk/posts': (route, headers) => failRefresh
        ? route.fulfill({ status: 503, headers, json: { success: false, data: null, error: { message: 'Conversations are temporarily unavailable.' } } })
        : route.fulfill({ headers, json: { success: true, data: { posts: [post()], nextCursor: null }, error: null } }),
    } });
    try {
      const { page } = fixture;
      await page.goto(origin + '/arena-talk');
      const conversation = page.getByText(post().body, { exact: true });
      await conversation.waitFor();
      const composer = page.locator('#arena-composer');
      assert.equal(await composer.getAttribute('open'), null, 'Reading starts with a compact composer');
      assert.equal(await page.getByLabel('Your post', { exact: true }).isVisible(), false);
      const article = await page.locator('.arena-post').first().boundingBox();
      assert(article.y < 820, `The first conversation starts in the initial viewport (${article.y}px)`);
      await page.screenshot({ path: join(output, `arena-after-${width}-${mode.toLowerCase()}.png`), fullPage: true });
      await composer.locator(':scope > summary').focus();
      await page.keyboard.press('Enter');
      await page.getByLabel('Your post', { exact: true }).waitFor({ state: 'visible' });
      await page.getByLabel('Your post', { exact: true }).fill('A draft worth keeping');
      await composer.locator(':scope > summary').click();
      assert.equal(await composer.getAttribute('data-has-draft'), 'true');
      await page.getByRole('link', { name: 'Write a post', exact: true }).click();
      assert.equal(await page.getByLabel('Your post', { exact: true }).inputValue(), 'A draft worth keeping');
      failRefresh = true;
      await page.getByRole('button', { name: 'Refresh feed', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Conversations are temporarily unavailable.' }).waitFor();
      assert(await conversation.isVisible(), 'Failed refresh retains the readable conversation');
      assert.equal(await page.getByLabel('Your post', { exact: true }).inputValue(), 'A draft worth keeping');
      failRefresh = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Conversations are temporarily unavailable.' }).waitFor({ state: 'hidden' });
      await checkLayout(page, `Arena reading ${width}px ${mode}`);
      assert.deepEqual(fixture.errors, []);
      assert.deepEqual(fixture.mutations, []);
      console.log(`PASS Arena reading ${width}px ${mode}: visible conversation, keyboard composer, retained draft and refresh recovery`);
    } finally { await fixture.context.close(); }
  }

  const fixture = await createUiContext(browser, { width: 390, direct: true, overrides: {
    '/api/arena-talk/context': contextData,
    '/api/arena-talk/posts': (route, headers) => route.fulfill({ headers, json: { success: true, data: {
      posts: [post(new URL(route.request().url()).searchParams.get('audience') === 'LEAGUE')], nextCursor: null,
    }, error: null } }),
  } });
  try {
    const { page } = fixture;
    await page.goto(origin + '/arena-talk');
    await page.getByText(post().body, { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Write a post', exact: true }).click();
    await page.getByRole('button', { name: 'Add a poll', exact: true }).click();
    await page.getByLabel('Option 1', { exact: true }).fill('Home win');
    await page.getByRole('button', { name: 'Remove poll', exact: true }).click();
    await page.getByRole('button', { name: /My League/ }).click();
    await page.getByRole('dialog').getByRole('heading', { name: 'Switch conversations?', exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Add a poll', exact: true }).click();
    assert.equal(await page.getByLabel('Option 1', { exact: true }).inputValue(), 'Home win');
    await page.getByRole('button', { name: 'Remove poll', exact: true }).click();
    await page.locator('#arena-composer input[type="file"]').setInputFiles(fileURLToPath(new URL('../../web/public/icons/icon-192-v3.png', import.meta.url)));
    await page.getByRole('button', { name: /My League/ }).click();
    await page.getByRole('dialog').getByRole('heading', { name: 'Switch conversations?', exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert(await page.getByRole('img', { name: 'Selected attachment preview', exact: true }).isVisible());
    await page.getByRole('button', { name: /My League/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Switch feed', exact: true }).click();
    await page.getByText(post(true).body, { exact: true }).waitFor();
    assert.equal(await page.getByText(post().body, { exact: true }).count(), 0);
    assert.equal(await page.locator('#arena-composer').getAttribute('data-has-draft'), 'false');
    assert.deepEqual(fixture.mutations, []);
    assert.deepEqual(fixture.errors, []);
    console.log('PASS hidden poll and attachment drafts require confirmation; audience and draft reset after approved switch');
  } finally { await fixture.context.close(); }

  const unmuteFixture = await createUiContext(browser, { width: 390, direct: true, overrides: {
    '/api/arena-talk/context': { ...contextData, mutedPlayers: [{ id: 'muted-player', fullName: 'Muted Captain' }] },
    '/api/arena-talk/posts': { posts: [post()], nextCursor: null },
  }, onMutation: (route, headers) => {
    assert.equal(new URL(route.request().url()).pathname, '/api/arena-talk/mutes/muted-player');
    assert.equal(route.request().method(), 'PUT');
    assert.deepEqual(JSON.parse(route.request().postData()), { muted: false });
    return route.fulfill({ headers, json: { success: true, data: {}, error: null } });
  } });
  try {
    const { page } = unmuteFixture;
    await page.goto(origin + '/arena-talk');
    await page.getByText(post().body, { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Write a post', exact: true }).click();
    await page.getByLabel('Your post', { exact: true }).fill('Keep my match report while changing preferences');
    await page.getByRole('button', { name: 'Add a poll', exact: true }).click();
    await page.getByLabel('Option 1', { exact: true }).fill('Home win');
    await page.locator('.arena-sidebar').getByText('Muted players', { exact: true }).click();
    const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/arena-talk/posts');
    await page.getByRole('button', { name: 'Unmute Muted Captain', exact: true }).click();
    await refreshed;
    await page.getByRole('button', { name: 'Refresh feed', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Your post', { exact: true }).inputValue(), 'Keep my match report while changing preferences');
    assert.equal(await page.getByLabel('Option 1', { exact: true }).inputValue(), 'Home win');
    assert.equal(unmuteFixture.mutations.length, 1);
    assert.deepEqual(unmuteFixture.errors, []);
    console.log('PASS unmuting refreshes the feed and preserves the open post and poll draft');
  } finally { await unmuteFixture.context.close(); }
} finally { await browser.close(); }
