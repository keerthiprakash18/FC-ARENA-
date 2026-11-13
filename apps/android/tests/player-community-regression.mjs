import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, user, career } from './phase-ui-harness.mjs';
import { summarizeExperience } from '../../api/src/experience/experience-policy.ts';

const output = path.resolve(process.env.COMMUNITY_SCREENSHOTS || '.cache/community/screenshots');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const leagueId = '01e150a6-1be1-4e30-9a67-8e6d80a64116';
const contextData = { leagues: [{ id: leagueId, name: 'Coastal Premier League' }], canModerate: true, policy: { audienceNote: 'Football Talk is visible to active FC ARENA members. League posts stay within that league. Posts and likes do not earn XP.' } };
const experience = summarizeExperience([{ week: '2026-10-26', matches: 10, days: 2, teamMatches: 0 }], 1, false, 'CLASSIC', new Date('2026-11-01T12:00:00Z'));
function fixturePost(privatePost = false) { return { id: privatePost ? 'private-post' : 'football-post', kind: 'DISCUSSION', body: privatePost ? 'Private league conversation' : 'Who controls the midfield this weekend?', sourceUrl: null, imageUrl: null, createdAt: '2026-11-01T12:00:00Z', editedAt: null, author: { id: 'opponent', name: 'Coastal Captain', inGameName: 'CoastalCaptain', playerCode: 'FC1024', avatarUrl: null, verified: true }, league: privatePost ? { id: leagueId, name: 'Coastal Premier League' } : null, audience: privatePost ? 'LEAGUE' : 'PUBLIC', reactionCount: 3, liked: false, commentCount: 0, canEdit: false, canDelete: true, canReport: true, result: null, poll: { endsAt: '2030-11-05T12:00:00Z', closed: false, totalVotes: 2, selectedOptionId: null, options: [{ id: 'home', label: 'Home team', votes: 1, percent: 50 }, { id: 'away', label: 'Away team', votes: 1, percent: 50 }] } }; }
const themes = process.env.COMMUNITY_INTERACTIONS_ONLY === 'true' ? [] : ['LUXURY_GOLD', 'CLASSIC_BLUE', 'CITY_SKY', 'LONDON_RED', 'MERSEY_RED', 'MADRID_ROYAL', 'CATALAN_NIGHTS', 'MUNICH_RED', 'PARIS_NIGHT', 'MILAN_BLUE', 'MILAN_RED', 'TURIN_MONO'];
let screens = 0;
try {
  for (const theme of themes) for (const width of [320, 390, 1280]) for (const mode of ['LIGHT', 'DARK']) {
    const { context, page, errors } = await createUiContext(browser, { width, theme, mode, overrides: {
      '/api/experience/me': experience,
      '/api/arena-talk/context': contextData,
      '/api/arena-talk/posts': { posts: [fixturePost()], nextCursor: null },
    }, onMutation: (route, headers) => route.fulfill({ status: 204, headers }) });
    try {
      await page.goto('https://fcarena.in/experience');
      await page.getByRole('heading', { name: 'Choose your card frame' }).waitFor();
      await checkLayout(page, `Experience ${theme} ${mode} ${width}`);
      const colors = await page.locator('.community-panel').first().evaluate(element => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
      assert.notEqual(colors.color, colors.background);
      if (theme === 'LUXURY_GOLD' && width === 390) await page.screenshot({ path: path.join(output, `experience-${mode.toLowerCase()}.png`), fullPage: true });
      await page.goto('https://fcarena.in/arena-talk');
      await page.getByText('Who controls the midfield this weekend?', { exact: true }).waitFor();
      await checkLayout(page, `Arena ${theme} ${mode} ${width}`);
      if (theme === 'LUXURY_GOLD' && width === 390) await page.screenshot({ path: path.join(output, `arena-${mode.toLowerCase()}.png`), fullPage: true });
      assert.deepEqual(errors, []); screens += 2;
    } finally { await context.close(); }
  }
  let selectedFrame = 'CLASSIC', failFrame = true, failPublish = true, published = false;
  let currentPost = fixturePost(); const comments = []; const postRequests = []; let cardBytes; const cardId = '81fb40f4-7e4f-40a6-a429-c87dd7242ae2';
  const { context, page, errors } = await createUiContext(browser, { width: 390, mode: 'DARK', overrides: {
    ['/api/players/card-exports/' + cardId]: (route, headers) => route.fulfill({ headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename=FC-ARENA-P3.png' }, body: cardBytes }),
    '/api/experience/me': (route, headers) => route.fulfill({ headers, json: { success: true, data: { ...experience, frame: selectedFrame }, error: null } }),
    '/api/arena-talk/context': contextData,
    '/api/arena-talk/posts': (route, headers) => { const privateFeed = new URL(route.request().url()).searchParams.get('audience') === 'LEAGUE'; return route.fulfill({ headers, json: { success: true, data: { posts: [privateFeed ? fixturePost(true) : currentPost, ...(published && !privateFeed ? [{ ...fixturePost(), id: 'created', body: 'My new football post', poll: null, canEdit: true }] : [])], nextCursor: null }, error: null } }); },
    '/api/arena-talk/posts/football-post': (route, headers) => route.fulfill({ headers, json: { success: true, data: { post: currentPost }, error: null } }),
    '/api/arena-talk/posts/football-post/comments': (route, headers) => route.fulfill({ headers, json: { success: true, data: { comments, nextCursor: null }, error: null } }),
  }, onMutation: async (route, headers) => {
    const url = new URL(route.request().url()); const data = route.request().postData();
    const ok = value => route.fulfill({ headers, json: { success: true, data: value, error: null } });
    if (url.pathname === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/api/players/me/card-export') { const r = route.request(); const form = await new Request(r.url(), { method: r.method(), headers: r.headers(), body: r.postDataBuffer() }).formData(); cardBytes = Buffer.from(await form.get('image').arrayBuffer()); return ok({ path: '/players/card-exports/' + cardId + '?grant=fixture.signature', filename: 'FC-ARENA-P3.png', expiresAt: new Date(Date.now() + 300000).toISOString() }); }
    if (url.pathname === '/api/experience/me/frame') { if (failFrame) { failFrame = false; return route.fulfill({ status: 403, headers, json: { success: false, data: null, error: { code: 'FRAME_LOCKED', message: 'This frame is currently unavailable.' } } }); } selectedFrame = JSON.parse(data).frame; return ok({ ...experience, frame: selectedFrame }); }
    if (url.pathname.endsWith('/vote')) { currentPost = { ...currentPost, poll: { ...currentPost.poll, totalVotes: 3, selectedOptionId: JSON.parse(data).optionId } }; return ok({ post: currentPost }); }
    if (url.pathname.endsWith('/reaction')) { currentPost = { ...currentPost, liked: JSON.parse(data).liked, reactionCount: JSON.parse(data).liked ? 4 : 3 }; return ok({ post: currentPost }); }
    if (url.pathname.endsWith('/comments')) { comments.push({ id: 'comment-one', body: JSON.parse(data).body, createdAt: '2026-11-01T12:10:00Z', author: { id: user.id, name: user.fullName, playerCode: 'P3', verified: true }, canEdit: true, canDelete: true, canReport: false }); currentPost = { ...currentPost, commentCount: 1 }; return ok({ comments, nextCursor: null }); }
    if (url.pathname === '/api/arena-talk/posts') { postRequests.push(data.match(/name="clientRequestId"\r\n\r\n([^\r]+)/)?.[1]); if (failPublish) { failPublish = false; return route.fulfill({ status: 500, headers, json: { success: false, data: null, error: { code: 'TEST_ERROR', message: 'Unable to publish right now.' } } }); } published = true; return ok({ post: { ...fixturePost(), id: 'created' } }); }
    throw new Error(`Unexpected mutation ${url.pathname}`);
  } });
  try {
    await page.goto('https://fcarena.in/experience');
    await page.getByRole('button', { name: /Gold standard/ }).waitFor(); assert(await page.getByRole('button', { name: /Gold standard/ }).isDisabled());
    await page.getByRole('button', { name: /Skyline/ }).click(); await page.getByText('This frame is currently unavailable.', { exact: false }).waitFor();
    assert.equal(await page.locator('.frame-choice[aria-pressed=true]').innerText(), 'Classic\nSelected ✓');
    await page.getByRole('button', { name: /Skyline/ }).click(); await page.waitForFunction(() => document.querySelector('.frame-choice.frame-SKY')?.getAttribute('aria-pressed') === 'true');
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download player card ↓', exact: true }).click();
    const download = await downloadPromise; const file = await download.path(); const bytes = fs.readFileSync(file); assert.equal(bytes.subarray(1, 4).toString(), 'PNG'); assert(bytes.length > 10000);
    await page.locator('.player-edition').screenshot({ path: path.join(output, 'player-card-final.png') });
    await page.goto('https://fcarena.in/arena-talk');
    await page.getByRole('button', { name: /Home team/ }).click(); await page.waitForFunction(() => document.querySelector('.poll-option')?.getAttribute('aria-pressed') === 'true');
    await page.getByRole('button', { name: '♡ Like · 3', exact: true }).click(); await page.getByRole('button', { name: '♥ Liked · 4', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Comments · 0', exact: true }).click(); await page.getByLabel('Add a comment', { exact: true }).fill('A thoughtful comment'); await page.getByRole('button', { name: 'Post comment', exact: true }).click(); await page.getByText('A thoughtful comment', { exact: true }).waitFor();
    await page.getByLabel('Your post', { exact: true }).fill('My new football post'); await page.getByRole('button', { name: 'Publish post ↗', exact: true }).click(); await page.getByText(/Unable to publish right now/).waitFor(); assert.equal(await page.getByLabel('Your post', { exact: true }).inputValue(), 'My new football post');
    await page.getByRole('button', { name: 'Publish post ↗', exact: true }).click(); await page.getByText('Your post is live.', { exact: true }).waitFor(); assert.equal(postRequests.length, 2); assert(postRequests[0]); assert.equal(postRequests[0], postRequests[1]);
    await page.getByRole('button', { name: /My League/ }).click(); await page.getByText('Private league conversation', { exact: true }).waitFor(); assert.equal(await page.getByText('Who controls the midfield this weekend?', { exact: true }).count(), 0);
    await page.getByRole('button', { name: /Football Talk All/ }).click(); await page.getByText('Who controls the midfield this weekend?', { exact: true }).waitFor(); assert.equal(await page.getByText('Private league conversation', { exact: true }).count(), 0);
    await checkLayout(page, 'Interactive feed'); assert.deepEqual(errors, []);
  } finally { await context.close(); }
  let reviewed = false;
  const profile = { ...career, profile: { ...career.profile, fullName: user.fullName, email: user.email, phoneNumber: null, joinedAt: '2026-01-01T00:00:00Z' } };
  const report = { id: 'report-one', reason: 'SPAM_OR_SCAM', details: 'Repeated advertising', createdAt: '2026-11-01T12:00:00Z', reporter: { name: 'Reporting player' }, post: { imageUrl: null, body: 'Reported community content', league: null, author: { name: 'Test author' } }, comment: null };
  for (const width of [320, 1280]) {
    const extra = await createUiContext(browser, { width, mode: 'LIGHT', overrides: {
      '/api/experience/me': experience,
      '/api/players/me/career': profile,
      '/api/experience/players/public-player': experience,
      '/api/discover/players/public-player': { player: { userId: 'public-player', fullName: 'Public captain', inGameName: 'LongPlayerNameWithoutSpacesThatStillFitsTheSmallestPhoneDisplay', playerCode: 'FC101', verified: true, profileImageUrl: null, joinedAt: '2026-01-01T00:00:00Z' }, lifetimeStatistics: career.lifetimeStatistics, leagues: [], achievements: [], seasonalAwards: [], ballonHistory: [] },
      '/api/fair-play/players/public-player': { fairPlay: { score: 100, status: 'GOOD_STANDING', activePenaltyEvents: 0, commendations: 0, lastUpdatedAt: null, detailVisibility: 'SUMMARY' } },
      '/api/arena-talk/moderation/reports': (route, headers) => route.fulfill({ headers, json: { success: true, data: { reports: reviewed ? [] : [report] }, error: null } }),
    }, onMutation: (route, headers) => { if (new URL(route.request().url()).pathname.includes('/moderation/reports/')) reviewed = true; return route.fulfill({ headers, json: { success: true, data: {}, error: null } }); } });
    try {
      await extra.page.goto('https://fcarena.in/profile');
      await extra.page.getByRole('heading', { name: 'Your player profile' }).waitFor();
      await extra.page.getByText('Player Journey, missions & XP', { exact: true }).click();
      await extra.page.locator('.mission').first().waitFor();
      await checkLayout(extra.page, `Profile ${width}`);
      await extra.page.getByRole('button', { name: 'Choose profile photo', exact: true }).waitFor();
      await extra.page.goto('https://fcarena.in/discover/players/public-player'); await extra.page.locator('.public-player-edition .edition-level').waitFor(); await extra.page.waitForFunction(() => document.querySelector('.public-player-edition .edition-level')?.textContent.includes('3')); await checkLayout(extra.page, `Public player ${width}`);
      await extra.page.goto('https://fcarena.in/admin/community');
      if (!reviewed) { await extra.page.getByText('Reported community content', { exact: true }).waitFor(); await checkLayout(extra.page, `Moderation ${width}`); await extra.page.getByLabel('Review note (required)').fill('Removed for spam after review.'); await extra.page.getByRole('button', { name: 'Remove content', exact: true }).click(); }
      await extra.page.getByText('No open community reports.', { exact: true }).waitFor(); assert.deepEqual(extra.errors, []);
    } finally { await extra.context.close(); }
  }
  console.log(`PASS: ${screens ? `${screens} responsive page checks across 12 themes, 2 display modes and 3 widths; ` : ''}frame errors/retry, PNG export, poll, reaction, comments, publish retry, league privacy, profile editing access, public player card and moderation review.`);
} finally { await browser.close(); }
