# FC ARENA — Birthday Magic V6 integration (staged, NOT live)

This feature ports the **approved bright rose, peach, lavender and warm-cream Birthday Magic V6 experience** into the signed-in FC ARENA dashboard. It is guarded by a **build-time, default-off feature flag**:

  NEXT_PUBLIC_BIRTHDAY_MAGIC_ENABLED=true

Do **not** enable the flag in a production bundle until ALL gates below pass.

## What the source implements now

- Private birthday eligibility using the signed-in /auth/me dateOfBirth and Asia/Kolkata calendar.
- Feb 29 is celebrated Feb 28 in non-leap years; tested.
- First dashboard visit on birthday prompts a full-screen birthday surprise; dismissal is stored per user and calendar day in localStorage. Replay is always available from the birthday banner.
- Personalized display name, profile picture and league context. Does not display DOB publicly.
- Cinematic opening (optional media with graceful fallback), candle wish, interactive real CSS cake cut, birthday letter, cosmetic birthday-edition player card, and bright full-day dashboard accents.
- Media can be muted, the experience skipped, and reduced-motion preferences are respected. Offline/missing audio never falls back to robotic browser TTS.
- **No API mutations, migrations, rewards/coins, stats, tournaments or awards touched.** Existing match and navigation UI is preserved.

## Required media delivery before staging / live

Use the existing **user-approved** private asset package, not the previous rejected V3/V5 visuals.

The exact files must exist in the immutable WEB artifact at:

| Static file | Expected source | Gate |
| --- | --- | --- |
| apps/web/public/birthday-magic/stadium.mp4 | Approved V6 Google Flow 10.03s 720×1280 film | SOURCE PRESENT as 18 base64 shards under `apps/web/birthday-video-src/`; npm prebuild verifies SHA-256 `f274956e3ec572a56f848e5c1057dda2add3b5bc631fda5fc295443f3cf49e07` and rebuilds the exact MP4 into the off-host WEB artifact. Watermark and Android playback remain acceptance gates. |
| apps/web/public/birthday-magic/ambient.mp3 | Owner-approved V4 peaceful music | SOURCE PRESENT: original uploaded Git blob SHA `ecb4c02912e92ea50929d1aeac4f8aa58bea3f76`. Android audio playback remains to be tested. |
| apps/web/public/birthday-magic/voice-opening.mp3 | Professionally recorded, licensed opening line | **NOT AVAILABLE YET**. No robotic TTS allowed. |
| apps/web/public/birthday-magic/voice-cake.mp3 | Professionally recorded, licensed cake-cut wish | **NOT AVAILABLE YET**. No robotic TTS allowed. |
| apps/web/public/birthday-magic/welcome.webp | Optional approved artwork | Has graceful warm-gradient fallback |
| apps/web/public/birthday-magic/cake.webp | Optional approved cake photo | Uses the V6 interactive CSS cake when absent |

Voice with spoken player names needs a separate **pronunciation-reviewed, server-verified audio workflow** before claims of personalized spoken names can be made. A static clip cannot truthfully say arbitrary names. Never concatenate phonemes or use browser speech synthesis. In the initial version the typed birthday name is personalized visually; common studio voice clip may be name-neutral. Secure media licensing/consent and audibility in real Android WebView must be verified before release.

The approved video and music are now versioned in this PR. Because the connected GitHub upload transport limits single binaries, the 4,945,590-byte MP4 is stored as 18 exact base64 source parts and reconstructed by `scripts/prepare-birthday-media.mjs` on the developer machine / GitHub Actions runner. The prebuild asserts its expected SHA-256 and fails closed. The generated MP4 is gitignored but included in the off-host runtime artifact by `npm run build:web`. Never run the build on VCL, copy this video into persistent user uploads, or create per-release user storage. The original user-approved audio recording files are **not available**; no robotic voice may be substituted.

## Acceptance / regressions

- Run node --test tests/date-of-birth.test.mjs.
- Run npm run lint --workspace=apps/web and npm run build:web (prebuild verifies and reconstructs the approved MP4).
- Check first-of-day open, skip, replay, long/unicode in-game names, no DOB, Feb 29, account switch, midnight transition, localStorage disabled.
- Check 320/360/390/412/430 mobile widths and real Android WebView; landscape/desktop layout and reduced-motion.
- No competing focus with Daily Rewards modal. Verify audio user-gesture handling, volume ducking and missing-audio fallback.
- Verify existing fixtures, scores, statistics, leaderboards, awards, tournaments, chat, navigation and logout unchanged.
- This uses localStorage only for dismissed state; multiple devices may each show the celebration once. **No claimable server reward exists**.
- For a genuine off-host production release follow repository AGENTS.md + ops/VCL_RELEASE_STORAGE_POLICY.md: updated live SHA, new backup plus upload recovery, protected rollback, security CI, artifact checksum, isolated rehearsal and actual host activation proof. **Do not merge/deploy by merely passing frontend CI.**

## Rollback / privacy

Disable NEXT_PUBLIC_BIRTHDAY_MAGIC_ENABLED and create a new off-host WEB artifact to remove the experience. The code makes no schema change, writes no DB record and reads only the signed-in user's already-authorized DOB. If the button is dismissed, that user's local browser stores only a user ID + observed calendar date flag. Delete is not necessary for competition data, and live server storage must never be cleaned as part of this change.


## Integration update — 20 November 2026

- Approved V6 warm welcome, boutique CSS cake and satin gift are now staged in the signed-in dashboard. No optional welcome image is required.
- The stadium clip is muted during playback so it does not overlap the approved background music. Natural voice remains absent. No browser TTS, invented voice file, or fabricated spoken player name.
- **DO NOT ENABLE OR DEPLOY** until Android WebView playback/accessibility, account switching, authenticated competition regressions, security gate #192, fresh DB and uploads off-host recoverability, exact off-host artifact rehearsal, VCL live identity and verified rollback all pass. The feature flag stays OFF by default.
