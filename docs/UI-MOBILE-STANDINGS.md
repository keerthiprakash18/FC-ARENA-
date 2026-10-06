# Compact mobile standings

UI-only follow-up to the premium redesign, based on `879b2c4` on
`ui-modernization-phases`.

## Components changed

- New shared `apps/web/src/components/tournaments/compact-standings-table.tsx`.
- Tournament group `StandingTable` in
  `apps/web/src/app/tournaments/[tournamentId]/standings/page.tsx`.
- Public tournament standings in
  `apps/web/src/app/public/tournaments/[code]/page.tsx`.
- Best Teams points table in
  `apps/web/src/app/tournaments/[tournamentId]/rankings/page.tsx`.
- Scoped mobile table/group-header rules in
  `apps/web/src/app/premium-redesign.css`.

## Mobile presentation

Below 640px, standings are semantic HTML tables with one compact row per team,
a shared header and aligned columns: **# / Team or Duo / P / GF / GA / GD / Pts**.
All seven columns fit at 360, 390, 412 and 430px. Rows are approximately 49px
high, with 13px team/stat text, a 24×28px crest and an emphasized gold points
column on deep navy. Existing group top-two emphasis is retained.

Long names use at most two lines in the main row. Tapping or keyboard-activating
the team name opens a secondary table row containing the full name, W/D/L and
form. Only one secondary row is open per table; every team's main statistics
remain visible. Stored logos are used where already supplied by group data,
with the existing initial-crest fallback otherwise.

Each tournament group has a compact navy identity header directly above its
table. Public standings retain a cream section header above the navy table.
Overflow is contained within the table if a narrower-than-target container
requires it. Tablet/desktop retain their existing detailed tables and contained
horizontal scrolling where necessary.

The standings sorting, positions, zero-result fallbacks, scoring, data requests,
permissions and tournament rules are unchanged. The shared component renders
the rows it receives without ranking or calculating statistics.

## Verification

- Web TypeScript and production build passed (62 generated routes).
- ESLint on changed TSX files: zero errors, two existing warnings.
- `apps/android/tests/standings-ui.mjs`: 96 populated route/viewport/theme
  checks passed at 360, 390, 412, 430, 768 and 1440px, both themes/modes,
  plus Android-UA light/dark coverage at all four phone widths.
- Checks cover seven-column visibility, header/row alignment, compact row
  height, crests, actual fixture values, positive/negative GD, three-digit
  goals, long duo/unbroken names, keyboard/tap disclosure, points access,
  contrast, no page overflow, no card-per-team rendering and no API mutations.
- Phase 5 broad regression passed: 84 routes at both 390 and 1440px, plus its
  keyboard, enlargement, error/retry and role checks; accessibility findings
  were empty. Its Team rankings selector now expects a table region.
- Populated screenshots for all three views were captured at every requested
  width in `/tmp/omnirush/standings-after`; phone, tablet and desktop renders
  were visually reviewed. `groups-table-360.png` and `public-table-360.png`
  show multiple teams with all seven main columns visible simultaneously.

Mobile standings now remain table-style rather than stacked team cards.
