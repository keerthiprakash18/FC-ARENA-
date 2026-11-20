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
| apps/web/public/birthday-magic/stadium.mp4 | User-supplied Google Flow 9:16 MP4 | Needed for cinematic scene; review 720p watermark and upgrade if an authorized clean 1080p source exists |
| apps/web/public/birthday-magic/ambient.mp3 | User-approved peaceful V4 instrumental | Needed for music |
| apps/web/public/birthday-magic/voice-opening.mp3 | Professionally recorded, licensed opening line | **NOT AVAILABLE YET**. No robotic TTS allowed. |
| apps/web/public/birthday-magic/voice-cake.mp3 | Professionally recorded, licensed cake-cut wish | **NOT AVAILABLE YET**. No robotic TTS allowed. |
| apps/web/public/birthday-magic/welcome.webp | Optional approved artwork | Has graceful warm-gradient fallback |
| apps/web/public/birthday-magic/cake.webp | Optional approved cake photo | Uses the V6 interactive CSS cake when absent |

Voice with spoken player names needs a separate **pronunciation-reviewed, server-verified audio workflow** before claims of personalized spoken names can be made. A static clip cannot truthfully say arbitrary names. Never concatenate phonemes or use browser speech synthesis. In the initial version the typed birthday name is personalized visually; common studio voice clip may be name-neutral. Secure media licensing/consent and audibility in real Android WebView must be verified before release.

Because this PR contains source-only files, the large video/music **are deliberately not attached to the PR via temporary signed URLs**, and audio recordings are not fabricated. Media should be added to the approved GitHub release source tree in a separate reviewed commit from the original files, then built **off-host on GitHub Actions**. Never write video files to VCL persistent user uploads or duplicate them across old release folders.

## Acceptance / regressions

- Run node --test tests/date-of-birth.test.mjs.
- Run npm run lint --workspace=apps/web and npm run build:web.
- Check first-of-day open, skip, replay, long/unicode in-game names, no DOB, Feb 29, account switch, midnight transition, localStorage disabled.
- Check 320/360/390/412/430 mobile widths and real Android WebView; landscape/desktop layout and reduced-motion.
- No competing focus with Daily Rewards modal. Verify audio user-gesture handling, volume ducking and missing-audio fallback.
- Verify existing fixtures, scores, statistics, leaderboards, awards, tournaments, chat, navigation and logout unchanged.
- This uses localStorage only for dismissed state; multiple devices may each show the celebration once. **No claimable server reward exists**.
- For a genuine off-host production release follow repository AGENTS.md + ops/VCL_RELEASE_STORAGE_POLICY.md: updated live SHA, new backup plus upload recovery, protected rollback, security CI, artifact checksum, isolated rehearsal and actual host activation proof. **Do not merge/deploy by merely passing frontend CI.**

## Rollback / privacy

Disable NEXT_PUBLIC_BIRTHDAY_MAGIC_ENABLED and create a new off-host WEB artifact to remove the experience. The code makes no schema change, writes no DB record and reads only the signed-in user's already-authorized DOB. If the button is dismissed, that user's local browser stores only a user ID + observed calendar date flag. Delete is not necessary for competition data, and live server storage must never be cleaned as part of this change.
