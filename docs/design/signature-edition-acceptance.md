# Signature Edition — founder acceptance ledger

Baseline: main f009fbdd69bcaf9e434ead4a3c193921b281d6b4; last owner-provided rollout verified four healthy instances and 54.92 GiB free. Public endpoint retrieval in both audit attempts was unavailable; do not treat prior rollout logs as a new live measurement.

## Root cause
Dark London, Mersey and Munich shared identical primary/soft values; most dark backgrounds were identical. Matchday gradients reused a navy formula and the more-specific arena stadium rule masked club hero backgrounds. Appearance used light-only generic placeholder blocks, even in dark mode.

## Implementation
Preserve all 12 existing persisted keys and LIGHT/DARK/SYSTEM, no new league/club assets, schema, endpoints or business-rule changes. New signature names and original static geometry; individualized dark surfaces and matchday accents, shared canonical token selectors for isolated previews. Keep award metals, statuses, native navigation and editorial layouts independent. The preview is an illustrative style sample, not a full-screen clone.

## Evidence and remaining gates
- Source contrast calculation in authoring: 528 literal pairs passed; does not certify rendered gradients, visual appeal or WCAG conformance.
- Prior theme candidate 65402da73ac5db672067ca9ee35a18eb1fa7b236: Frontend CI run 45844562535 passed 4 galleries and 24 actual dashboard theme/mode cases; screenshot artifact 15131961903. Manual visual review remains open. Final-source gate run 45844562435 failed on obsolete Vercel/Railway assertion. Align the strict source gate and worksheet with VCL hosting; retain other Data Safety checks. Revised candidate 19fe24e2d3470eb4d6c737dfe94c080a057ce226 final-source gate job 140009016913 passed Data Safety and provider consistency (twice). Other checks remain candidate-specific.
- Existing Android, tournament, award, admin, security and recovery regression gates remain mandatory.
- No direct new live authenticated audit, physical device or production metrics in this session.

## Subsequent source improvements
- Header theme picker previously used the old static light swatches even after Appearance was redesigned. It now uses canonical theme artwork, active display mode, wrapped labels and semantic error text; retains modal focus restoration and preference API. Two rendered header cases added to CI.
- Dashboard career strip now follows matchday surface and accent instead of fixed navy/gold. Career Goal balance compares verified scored/conceded counts on a common scale, preserves existing scope and shows an empty state. Extended 24-theme/mode career assertions.
- New changes require exact candidate regression; previous green results do not certify them.

## Company trust and compliance
- Source privacy policy and Terms exist; privacy references obsolete hosting providers. Correct current production host wording; confirm all remaining processor contracts, regions, actual data flows and retention with operator before declaring policy complete.
- Existing policy describes public account-deletion route, in-app requests, report/block, moderation, optional WhatsApp sharing, Firebase and provider data. Verify actual deletion propagation including backup retention, media, OAuth, FCM and third parties; do not test destructive flows on live data.
- Verify Play Console Data safety and external deletion URL, community moderation operations, terms acceptance, age controls and actual SDK behavior against Google Play User Data and UGC policies. Console evidence not available.
- Indian DPDP readiness: phased commencement; review applicability, notices, lawful consent, grievance/access/correction/erasure, children's safeguards and incident response with counsel. No legal certification claimed.
- Club-inspired names are unofficial; document asset and trademark rights (including existing logos, game references and media) before using official club branding. No new rights claimed.
- Do not add fabricated company registration, address, policies or compliance claims.
- P1 follow-ups: match center and verified analytics, tournament lifecycle, admin workflows, daily engagement, field performance, visual accessibility and motion; retain current behavior until exact acceptance evidence.
- No production writes, deploy, migration, retention change or Android publication.

## Manual review of exact previous candidate — 26 November 2026
Reviewed GitHub artifact 15134291841 (PR head b0034dcd6e521e5ef53ae52e11702a933aa0e493) directly: all 24 dashboard palette screenshots as two contact sheets, dark desktop appearance gallery, dark mobile quick picker, mobile Match Room and dark Career screenshot. Dark surfaces and geometry are visibly distinct; light mode retains neutral content; gallery button baselines were inconsistent and Match Room retained a generic gold/navy broadcast, low-contrast status treatment and duplicate countdown. Current source addresses these with aligned gallery actions, theme-aware score/crest/status, explicit lifecycle guidance and one countdown that stops at the end and while hidden. Score reveal is bounded, desktop-only, keyed to verified score changes; reduced motion and forced colors remain supported. New CI includes 36 match-state/theme/layout cases. These changes are not visually accepted until the new candidate renders. Prior eight workflows passed; do not transfer that status to the new commit.

## Remaining-work continuation — 27 November 2026 (IST)

Resumed exactly at `0d3d0c60573997766deb8b2ec17556f84c1ad1fb`; retained the completed design and business logic. The four failing CI workflows shared a source-less `RESULT` fixture. The fixture now references an actual isolated match. Account deletion preserves the opaque authored `clientRequestId` required by `arena_post_source_check`, clears the content hash, and uses the existing serializable retry helper with an active-account recheck. No constraint, schema or migration was changed.

Local PostgreSQL 17 account-deletion acceptance: four tests passed, including negative constraint checks, simultaneous deletion/edit requests, immediate stale-image-grant denial, OCR file deletion, aged orphan-image cleanup, retained/recent image protection, session revocation and retained match/history references. Synthetic Cloudinary responses verify explicit positive confirmation and fail-closed handling of an empty HTTP 200; this is not evidence of a live provider deletion. API build/lint and 1,024 unit tests passed. Windows full E2E passed 171 tests with one symlink-privilege failure; exact Linux CI is the authoritative full-suite gate.

Manually reviewed the previous head's 24 dashboard palettes and all theme Match Center screenshots. New local production renders pass 48 WCAG audits (zero detected violations), three reflow/200% text widths, keyboard/forced-color checks, desktop/reduced/native score motion, 39 Match Center cases (including long names and enlarged text), four appearance galleries, two header pickers and 24 dashboard theme/mode cases. Fixed only demonstrated defects: the 320px Both Ready overlap, an accessible-name mismatch, the light-gold result badge contrast, and the old native score animation falling through. The existing performance regression passes bounded fixture rendering, merged refreshes and offline/realtime draft preservation at 360/1280px. Browser automation does not certify physical handset, screen reader or field performance.

Existing encrypted off-host backup was independently restored to disposable PostgreSQL 17: 68 tables, all 51 migration checksums, all constraints validated, 143 media files and 111 provider assets accounted for; no unavailable provider assets in the backup manifest. Real restored data is checked only read-only. Exact final artifact staging/rollback and candidate CI are recorded separately after the source is frozen.

`FC_ARENA_SIGNATURE_GUARDED_DEPLOY.py` provides read-only preflight and separately approved apply modes; eight offline admission tests pass. See `docs/readiness/signature-guarded-release.md`. External compliance, private Play Console and physical-device evidence remain mandatory. The available browser session redirected Play Console to its public landing page, and `adb devices -l` found no physical device. No production data, service, storage or environment changes were made by this continuation. No deploy, merge, signing or Play publication was performed.
