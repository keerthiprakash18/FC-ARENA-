# FC ARENA design skills and production release contract

## Current baseline

The selected production-source snapshot from 11 November 2026 recorded:
- Web release: `adbfc72fa4882ee4123287228c217450d3322c4f`
- API release: `35ee5fa09f043d89500ce49bd5a3f13a4442cdf9`

The checked GitHub `main`, local Windows working tree and actual VPS releases may differ. Never deploy an old checkout blindly.

## Skills are **developer aids**, not app features

- **UI/UX Pro Max**: layout, typography, contrast, adaptive mobile UI and design-system review. Optional Windows/Codex setup: `npx --yes ui-ux-pro-max-cli init --ai codex`; Python 3 is needed for its design search utilities.
- **Taste Skill** (`design-taste-frontend`): premium art direction, restrained motion, real-world browser checking; optional setup: `npx --yes skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend --agent codex --copy -y`. Its v2 is changing; review the version before installation.
- **Apple-style interaction design**: apply concise tactile feedback, readable hierarchy, accessible controls and reduced motion. No separate verified Apple package is bundled.
- **Inspo MCP**: optional inspiration only. Connection/permissions have not been verified. Do not share private user data or project secrets.
- **Web accessibility guidelines**: manual and automated checks for keyboard/focus, readable errors, light/dark contrast, 44px targets, animation preferences and Android WebView sizes.

Run `powershell -ExecutionPolicy Bypass -File .\scripts\setup-design-skills.ps1` for an install preview and `-Apply` after reviewing third-party sources. These tools should live in the **development** environment, never on the production VPS.

## Brand/product contract

Use FC ARENA's existing navy/gold branding, official logo assets and `apps/web/src/app/design-tokens.css`. Do not duplicate tokens or invent match/league statistics. Preserve existing users, scores, results, fixtures, role permissions, standings, history, awards and tournament formats.

Start with theme-aware Tournament Wizard/Review, match evidence, player dashboard and notifications. Pilot new scheduling, weekly missions, league chat, tournament formats and AI assistance behind feature flags. Check each role and mobile/desktop/Android WebView, including slow network and reduced motion.

## Before any live release

1. Reconcile live web/API build IDs, actual `/opt/fcarena` source, GitHub `main`, and local Windows changes. Make recoverable source/build and production database backups. Verify the destination host; historical CI host may be stale.
2. Run `npm run verify:live-baseline` from the live snapshot with `LIVE-SOURCE-MANIFEST.json`. If the manifest is absent, set **both** `FC_ARENA_EXPECTED_WEB_RELEASE` and `FC_ARENA_EXPECTED_API_RELEASE` using independently verified active SHA values. Any mismatch blocks release; do not bypass.
3. Use Node >=24: `npm ci`; `npm run lint`; `npm run build:web`; `npm run build:api`; `npm run verify:live-baseline:test`; relevant API, tournament, security and Android/browser regression tests. Conduct authenticated staging checks with non-production accounts.
4. Stage only reviewed source **against the actual current live baseline**, test post-release web/API identities, and keep a rollback artifact. Database migrations require staging validation and a production backup. Android native changes need a separate signed Play release.
5. Measure p95 latency, 5xx, background job health, real-device crashes and match/dispute completion after activation.

**This PR does not perform production deployment**, access the VPS, run migrations, sign Play releases or install third-party code on a user's PC.
