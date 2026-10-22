# Phase 2 customization slice

This slice adds two organizer/player customization flows while preserving the
existing notification and tournament contracts:

- League organizers can clone any tournament from the League Tournaments list.
  The existing `POST /tournaments/:tournamentId/clone` authorization and draft
  creation flow remain the source of truth; the web action sends a new name and
  opens the cloned draft in the normal setup wizard.
- Players can choose notification categories under **Settings → Notifications**.
  Preferences default to enabled, so existing delivery remains unchanged until
  a player opts out. The same preference gate is used for in-app and Fair Play
  notifications, which also feed the existing phone push worker.
- Players can hide dashboard sections under **Settings → Dashboard**.

## Dashboard layout limit

This release intentionally implements visibility preferences rather than
drag-and-drop card ordering. A true layout editor would require introducing and
migrating a broader ordered-layout schema, with more complex responsive and
fallback behavior. The preference-based section visibility is additive,
portable across sessions, and safe to roll back without changing dashboard data
or existing API response shapes.
