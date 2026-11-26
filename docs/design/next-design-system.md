# FC ARENA NEXT — canonical design system

The implementation extends Obsidian Matchday and the existing FC ARENA identity. Source of truth: `apps/web/src/app/design-tokens.css`, the ordered `arena-consolidated.css`, `src/lib/theme.ts`, and shared `components/fc` / `components/premium` components. This document does not establish whole-product visual acceptance.

## Identity and hierarchy

- Preserve the official FC ARENA crest, English product interface and the existing competitive, fair, respectful voice.
- Give match identity, score/status and the next authorized action priority. Put supplementary explanations, configuration and history behind clear optional disclosures where appropriate.
- Reserve championship decoration for matches and awards. Account settings, search, community and operations use restrained semantic surfaces.
- Distinguish pending results, verified results, provisional races and official honours. Never derive an award, performance metric or winner from decorative UI state. See `arena-content-system.md` for exact terminology and sporting invariants.

## Tokens

| Role | Existing contract |
| --- | --- |
| Typography | Bundled variable Geist, `--fc-font`; responsive headings, readable body copy, tabular numerals for scores/counts |
| Surfaces | `--theme-background`, `--theme-surface`, `--theme-elevated`, `--theme-border` |
| Text | `--theme-text`, `--theme-text-secondary`, `--theme-text-muted`; never use a pale decorative kicker on an unrelated light surface |
| Actions | `--theme-primary`, `--theme-on-primary`, `--theme-primary-hover`, `--theme-primary-soft` |
| Semantics | Dedicated success/warning/danger text and soft background pairs; status text accompanies color |
| Focus | `--theme-focus`, visible outline with offset; retain native keyboard semantics |
| Spacing | Existing 4/8/12/16/24/32 px scale; fluid page/section gaps; component-local responsive layout |
| Geometry | Existing 20 px card radius, 12 px control radius and restrained surface shadows |
| Targets | At least 44 CSS px for changed interactive controls; expandable composer summary at least 48 px |
| Motion | Existing 160 ms transform/opacity feedback where useful; respect reduced motion, avoid continuous idle animation |

All twelve persisted palettes remain available: Luxury Gold, Classic Blue, City Sky, London Red, Mersey Red, Madrid Royal, Catalan Nights, Munich Red, Paris Night, Milan Blue, Milan Red and Turin Mono. Preserve both Light and Dark modes and existing stored preferences. Fan theme names do not imply affiliation. New components use semantic tokens rather than new hardcoded brand colors.

## Components and states

Use `AppShell`, `FcPageHeader`, `FcPanel`, `FcStatusBadge`, `FcMenuRow`, shared buttons/inputs and existing match/fixture components. Local CSS modules may arrange a screen without creating a parallel global theme layer.

- **Loading:** use existing skeletons matching the eventual content. Search marks its result region busy; loading does not assert an empty result.
- **Empty:** distinguish an authoritative empty response from a failed request; give a relevant existing next action.
- **Error:** retain readable data and drafts where possible, expose the actual error and a functioning retry; independent featured/search failures do not overwrite one another.
- **Navigation:** preserve all primary destinations and role-filtered More/admin links. Account settings keep all seven destinations, grouped by experience, privacy and account data, plus the existing profile route.
- **Disclosure:** native `details` / `summary` supports pointer and keyboard activation. Arena Talk starts with a compact composer so conversations are visible sooner. Its explicit Write a post link opens the form. Collapsing retains the draft and attachments.
- **Drafts:** before changing community audience, confirm whenever body, source, attachment or retained poll text exists. An Unmute refresh reloads feed data without remounting the composer. Do not claim persistent draft storage across closing the app.
- **Responsive:** flexible grids, `min-width: 0`, wrapping long identities and labels; no page-level horizontal overflow. Retain safe areas, bottom navigation and Android WebView behavior.

## Research and evidence

The attempted Refero premium sports search returned `NO_SUBSCRIPTION`; no unavailable design output is claimed. The working visual reference remains the existing reviewed synthetic baseline in `next-visual-baseline.md`.

Reviewed public primary references on 26 November 2026:

- [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/): inference applied here is clear hierarchy and access to existing tasks with minimal interruption.
- [Apple motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion): purposeful brief feedback and optional/reduced motion; no decorative animation is required to understand state.
- [FotMob's published product feature description](https://apps.apple.com/us/app/fotmob-soccer-live-scores/id488575683): match information and personally relevant alerts inform the existing next-match priority. No FotMob assets or unsupported data are introduced.
- [Sofascore's rating explanation](https://corporate.sofascore.com/about/rating): statistical provenance informs keeping FC ARENA's existing verified statistics and eligibility; no external rating formula is copied or invented.

Acceptance evidence is recorded in `next-discover-settings-evidence.md`, `next-execution-checklist.md` and `docs/readiness/next-qa-evidence-20261126.md`. Synthetic screenshots are not production usage evidence, screen-reader certification, physical-device acceptance or measured field performance.
