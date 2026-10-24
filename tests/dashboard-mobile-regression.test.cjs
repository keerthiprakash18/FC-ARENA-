const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('classic dashboard hero contract stays intact', () => {
  const dashboard = read('apps/web/src/app/dashboard/page.tsx');

  for (const signature of [
    'fc-dashboard-hero fc-stadium-surface relative min-h-[220px] overflow-hidden rounded-2xl border',
    'relative z-10 grid min-h-[220px] gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[auto_minmax(0,1fr)_300px]',
    'FC ARENA MATCHDAY',
    'Your next opponent, your competition, and your season — all in one place.',
  ]) {
    assert.ok(
      dashboard.includes(signature),
      `Dashboard hero signature changed: ${signature}`,
    );
  }
});

test('dashboard exposes and applies an explicit multi-league context', () => {
  const dashboard = read('apps/web/src/app/dashboard/page.tsx');

  assert.match(dashboard, /const \[selectedLeagueId, setSelectedLeagueId\] = useState\(""\)/);
  assert.match(dashboard, /aria-label="Dashboard league context"/);
  assert.match(dashboard, /Match and tournament cards use the selected League\./);
  assert.match(
    dashboard,
    /tournaments\.filter\(\s*\(tournament\) => tournament\.leagueId === selectedMembership\.league\.id/s,
  );
  assert.match(
    dashboard,
    /fixtures\.filter\(\(fixture\) => scopedTournamentIds\.has\(fixture\.tournamentId\)\)/s,
  );
  assert.match(
    dashboard,
    /scopedTournaments\.find\(\s*\(tournament\)/s,
  );
});

test('dashboard removes the duplicate inbox strip but preserves the header notification bell', () => {
  const dashboard = read('apps/web/src/app/dashboard/page.tsx');
  assert.doesNotMatch(dashboard, /Your action inbox|Reminders & approvals/);
  assert.match(read('apps/web/src/components/app/app-header.tsx'), /<NotificationBell\s*\/>/);
});

test('Next Match has a single-column empty state and only shares columns with a visible league card', () => {
  const dashboard = read('apps/web/src/app/dashboard/page.tsx');
  assert.match(dashboard, /fc-next-match-empty[^"\n]*grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(dashboard, /isVisible\("nextMatch"\) && isVisible\("league"\) \? "xl:grid-cols-/);
  assert.match(dashboard, /No upcoming matches scheduled/);
});

test('mobile bottom navigation remains five equal columns', () => {
  const premiumCss = read('apps/web/src/app/premium-redesign.css');
  const navigation = read('apps/web/src/components/app/primary-navigation.ts');

  assert.match(
    premiumCss,
    /\.premium-primary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/s,
  );

  const primaryItems = [
    "href: '/dashboard'",
    "href: '/leagues'",
    "href: '/tournaments'",
    "href: '/fixtures'",
    "href: '/more'",
  ];

  for (const item of primaryItems) {
    assert.ok(navigation.includes(item), `Missing primary mobile destination: ${item}`);
  }
});

test('mobile visual smoke covers target production widths', () => {
  const smoke = read('apps/android/tests/smoke.mjs');
  for (const width of [360, 390, 412, 430]) {
    assert.ok(smoke.includes(String(width)), `Missing mobile smoke width: ${width}`);
  }
});


test('native Android inherits the same mobile hero and five-column navigation layout as web', () => {
  const nativeCss = read('apps/web/src/app/native-android.css');

  assert.doesNotMatch(
    nativeCss,
    /grid-template-columns\s*:\s*repeat\(7\s*,/i,
    'Native Android must not override the five-column mobile navigation with seven columns',
  );

  assert.doesNotMatch(
    nativeCss,
    /\.fc-dashboard-hero\s*\{[^}]*min-height\s*:/s,
    'Native Android must inherit the web dashboard hero height',
  );

  assert.doesNotMatch(
    nativeCss,
    /\.fc-dashboard-hero\s*>\s*\.relative[^\{]*\{[^}]*padding\s*:/s,
    'Native Android must inherit the web dashboard hero padding',
  );

  assert.doesNotMatch(
    nativeCss,
    /\.fc-dashboard-page\s*\{[^}]*row-gap\s*:/s,
    'Native Android must inherit the web dashboard section rhythm',
  );

  assert.doesNotMatch(
    nativeCss,
    /\.premium-primary-grid[^\{]*\{[^}]*grid-template-columns\s*:/s,
    'Native Android must inherit the canonical five-column primary grid',
  );
});
