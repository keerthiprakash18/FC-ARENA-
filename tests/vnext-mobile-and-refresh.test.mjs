import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('rankings conserve mobile requests when hidden, offline and on resumed focus', () => {
  const source = read('apps/web/src/app/leaderboards/page.tsx');
  assert.match(source, /navigator\.onLine === false/);
  assert.match(source, /document\.visibilityState !== 'visible'/);
  assert.match(source, /Date\.now\(\) - lastRequestedAt < 15_000/);
  assert.match(source, /const timer = window\.setInterval\(update, 60_000\)/);
  assert.match(source, /window\.addEventListener\('online', update\)/);
  assert.match(source, /inFlight/);
  assert.match(source, /controller\.abort\(\)/);
});

test('notification polling avoids hidden/offline requests without delaying mutations', () => {
  const source = read('apps/web/src/app/notifications/page.tsx');
  assert.match(source, /const autoRefresh = \(\) => \{/);
  assert.match(source, /navigator\.onLine === false/);
  assert.match(source, /document\.visibilityState !== "visible"/);
  assert.match(source, /Date\.now\(\) - lastAutoRefreshAt < 15_000/);
  assert.match(source, /window\.setInterval\(autoRefresh, 60_000\)/);
  assert.match(source, /window\.addEventListener\("online", autoRefresh\)/);
  assert.match(source, /void loadNotifications\(true\)/);
  assert.match(source, /window\.removeEventListener\("online", autoRefresh\)/);
});

test('tournament controls use the existing brand theme and scroll safely at narrow widths', () => {
  const source = read('apps/web/src/app/tournaments/page.tsx');
  assert.match(source, /aria-label="Select tournament league"/);
  assert.match(source, /aria-label="Filter tournaments by status"/);
  assert.match(source, /aria-pressed=\{filter === value\}/);
  assert.match(source, /overflow-x-auto overscroll-x-contain/);
  assert.match(source, /whitespace-nowrap/);
  assert.match(source, /min-h-11/);
  assert.match(source, /theme-primary-button/);
  assert.match(source, /theme-secondary-button/);
  assert.match(source, /var\(--theme-border\)/);
});

test('Arena Talk audience controls are explicit buttons with announced audience information', () => {
  const source = read('apps/web/src/app/arena-talk/page.tsx');
  assert.match(source, /role="group"\s+aria-label="Conversation audience"/);
  assert.match(source, /<button\s+type="button"\s+aria-pressed=\{scope === "PUBLIC"\}/);
  assert.match(source, /<button\s+type="button"\s+disabled=\{!context\.leagues\.length\}/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /confirmAction\(/);
});

test('FC ARENA stays English-only as requested; no new language toggles introduced', () => {
  const layout = read('apps/web/src/app/layout.tsx');
  const settings = read('apps/web/src/app/settings/page.tsx');
  assert.match(layout, /lang="en"/);
  assert.doesNotMatch(settings, /useAppLanguage|App language|fc-arena-ui-language/);
});

test('Player Journey keeps one main landmark and announces completed-goal counts', () => {
  const source = read('apps/web/src/app/experience/page.tsx');
  assert.doesNotMatch(source, /<main className="community-page">/);
  assert.match(source, /<div className="community-page">/);
  assert.match(source, /aria-label=\{`\$\{goal\.label\}: \$\{goal\.value\} of \$\{goal\.target\}`\}/);
  assert.match(source, /<button type="button" onClick=\{\(\) => void load\(\)\}>Try again<\/button>/);
});

test('the long profile offers a keyboard-accessible compact Player Journey', () => {
  const source = read('apps/web/src/app/profile/page.tsx');
  assert.match(source, /<details onToggle=\{event => setJourneyExpanded\(event\.currentTarget\.open\)\} className="group rounded-2xl/);
  assert.match(source, /<summary className="theme-text flex min-h-11/);
  assert.match(source, /Player Journey, missions &amp; XP/);
  assert.match(source, /<PlayerJourney player=/);
  assert.match(source, /journeyExpanded \? <PlayerJourney player=/);
  assert.match(source, /group-open:hidden/);
  assert.match(source, /focus-visible:outline-offset-2/);
});
