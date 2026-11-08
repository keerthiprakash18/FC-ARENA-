# Player progress and Arena Talk

Player Journey is available at `/experience` and on `/profile`. More and the desktop sidebar link to both Player Journey and Arena Talk. Each league overview links to its private conversation. Public player pages show the selected card frame and public progress summary.

## Progress policy (version 1)

- Each canonical, confirmed, completed match awards 20 XP to the participants in its APPLY event snapshot. The fixture must also be completed. Duplicate submissions and superseded results do not count.
- Completed tournament participation awards 50 XP, based on the existing participation achievement and completion integrity.
- Weekly bonuses: one match +10, two active days +20, three matches +30, and a registered duo/team match +15 for squad participants. Bonuses are automatic and awarded once per mission and week.
- Weeks begin Monday at 00:00 Asia/Kolkata. Historical corrections stay in the original confirmation week. Reversals reconcile match and mission XP automatically.
- Level L begins at `50 * L * (L - 1)` XP. Frames unlock at levels 1, 3, 6 and 10. A frame that becomes ineligible after a reversal falls back to Classic.
- XP measures verified participation. It does not alter standings, competitive rankings or Fair Play. Posting, reactions and polling do not award XP.

## Conversations and access

Football Talk is available to active signed-in accounts. League posts require current membership, ownership or administration; super admins can moderate across leagues. Blocking works in both directions. Inactive authors and removed content disappear from ordinary reads, including direct post and image reads.

Members can create discussions, questions, sourced news, explicitly unverified rumours, optional images and 2–4 option polls. Official result cards are created only in the corresponding league feed and resolve current canonical scores on every read. Reversed results disappear. Members cannot forge, edit or remove official cards; corrections use the existing match workflow.

Post and comment creation use client request IDs for retry safety. Reactions use a desired boolean state; each player has one mutable vote per poll. Poll closure and ownership are checked on the server. User caps supplement existing API rate limits: 5 posts and 30 comments per 10 minutes, and 10 reports per hour. League admins can remove league content with a reason; super admins review the report queue at `/admin/community`. Decisions are audited.

## Storage and rollout

Apply migration `20261101090000_player_experience_arena_talk` before starting the new API. It only adds progress preferences, community tables, constraints and participant query indexes. It does not backfill mutable XP balances or change existing match results.

Set `ARENA_MEDIA_DIR` to a persistent directory owned by the API service, outside public/static web roots. The default is `storage/arena-talk` relative to the API working directory. Include this directory in operational backups and preserve it across releases. `JWT_ACCESS_SECRET` signs ten-minute image grants; every read rechecks current access and active session status where available. Responses are private and never cached publicly. Images are validated and re-encoded to WEBP with metadata removed; uploads are capped at 5 MB and stored images at 1 MB. Cleanup runs every six hours for orphaned files older than 24 hours and removed-post images older than 30 days.

Deploy API/schema first, then web. To roll back the web/API, retain the additive tables and media directory; do not drop community data. Public player cards and downloaded PNGs exclude account email, phone and game UID. The privacy page documents community data and retention.

## Verification

- Backend unit tests: `npm run test --workspace api`.
- PostgreSQL/HTTP tests: set `NODE_ENV=test` and `DATABASE_URL` to an explicitly disposable loopback database ending in `_test`, apply migrations, then run `npm run test:e2e --workspace api -- test/player-community.e2e-spec.ts`.
- UI: run a production web server and set `SMOKE_WEB_ORIGIN` before running `node apps/android/tests/player-community-regression.mjs`. The script uses mocked API fixtures for interaction tests and checks twelve themes, light/dark modes, and 320/390/1280 widths. `COMMUNITY_INTERACTIONS_ONLY=true` skips the theme matrix for targeted reruns.
