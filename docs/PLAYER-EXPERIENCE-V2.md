# Player experience v2

Implemented: ID-based My/All Matches, collapsed advanced filters and reset, completed fixture grouping, recoverable Home/Fixtures/Match errors, accessible shared confirmations replacing all browser confirms, live system appearance, aligned theme preview/reset copy, dismissible account-scoped onboarding, action-inbox notification filter, hidden-tab notification pause, league code/share invitation, player PNG sharing/download, verified career history search and year archive, readable leaderboard labels/find own rank, collapsed More groups, knockout round selector, collapsed admin fixture scheduling and visible UI version.

Validation: production Next.js build passed; TypeScript passed; ESLint has no errors (121 warnings, predominantly existing rules). No scoring, auth, database or native Android scrolling changes. Browser/native regression tests have not been rerun for v2.

Original remaining scope (see v3 completion notes): QR invitations; result image cards; identity-based head-to-head and season records; enhanced tournament personal progress and draft UX; shared notification cache; complete match-center progressive disclosure; OS push integration; historical rank snapshots. Existing fixture-generator drafts, reminders and tournament poster export remain available. Do not describe these remaining items as delivered by v2.
