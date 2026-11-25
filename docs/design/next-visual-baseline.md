# FC ARENA NEXT — visual baseline and design foundation

## Evidence
- GitHub Frontend CI run 45680204715, source b4676cc9106b453b566155f61f980a64631605db, artifact 15053897281.
- Reviewed synthetic mobile (390 px) and desktop (1440 px) screenshots of dashboard, career, profile, journey, match detail, tournament setup, awards, system monitoring; dark dashboard and awards.
- This is a fixture-based CI baseline, not a production screenshot audit or Android physical-device run.
- All 408 literal semantic color pair checks pass across 12 existing palettes, both modes. Preserve all existing user theme preferences. Rendered contrast is a separate gate.

## Decision
Extend the existing navy/gold sports identity, canonical Geist tokens, FcPanel/FcPageHeader/FcStatusBadge/FcStatCard, PremiumMatch and AppShell. No competing framework, rewrite, palette deletion or feature deletion. Championship styling stays concentrated on awards and matchday; operational screens use restrained surfaces.

## Observed improvement targets
- Mobile dashboard: narrow fourth career metric splits "Achievements" midword. Preserve the count and link; use a compact, legible metric label or responsive layout. Long player names must wrap without overlap.
- Dashboard: existing match action is valuable; avoid repeating inactive destinations before actionable tasks.
- Player Journey: stacked weekly goals occupy much of the first mobile viewport; integrate verified server activity and compact presentation while keeping all goal targets, no extra rewards.
- Career/Profile: repeated navigation and identity blocks consume vertical space. Keep career scope, verified state, photo and contact controls, and all links reachable.
- Match detail: local-draft notice and back links precede the match identity; move supporting context below the primary match header only if existing draft recovery behavior and safety remain intact.
- Tournament wizard: keep saved step and validation order; improve progress and navigation wrapping without changing generation or qualification.
- Awards: retain current season status, eligibility and official rankings, no fabricated standings.
- Admin system: surface actionable failures and preserve operational context; do not change authorization.
- Desktop: use space to prioritize meaningful content rather than duplicate mobile cards. Preserve native WebView safe areas and mobile navigation.

## Acceptance
Test 320/360/390/412/430/768/1280/1440 widths, light/dark, long names, empty, loading, error, pending and completed states; role-aware navigation and keyboard focus; no clipping or horizontal page overflow. Compare before/after screenshots against the existing CI baseline. Use disposable fixtures, not production data. Source-level palette contrast is not an accessibility certification. The final release requires device QA, full CI and independent recovery/release gates.
