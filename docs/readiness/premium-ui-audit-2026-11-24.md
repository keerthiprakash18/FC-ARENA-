# FC ARENA premium UI audit — 24 November 2026

The owner requested a complete UI audit, correction of actionable gaps and
deployment. Production was inspected at `48f171ac` before this release; main
already contained the separate Obsidian visual foundation. This release
reviews that foundation together with the refinements below. It is not an
automatic claim that a source commit is live.

## Findings resolved

1. **Too much decoration before the task.** Fixture lists, standings,
   tournament rankings, playoff workspaces, seasonal rankings, League War
   listing and analytics now opt into a compact editorial header. Competition
   identity, welcome, match and honours features keep their distinct navy
   treatment. Ordinary utility headers no longer repeat the pitch illustration.
2. **Repeated next-match destinations.** The visible dashboard match card
   keeps one direct match entry. The action queue no longer repeats that same
   fixture, and matchday guidance remains as supporting text. Profile/join/
   approval actions, hidden-section preferences and Next/Previous navigation
   remain available. A populated desktop dashboard places welcome beside the
   next match instead of stacking two full-width features.
3. **Ranking buried beneath instructions.** The awards feature and real
   seasonal podium precede the tournament honours guide. The full player/team
   awards explanation remains available through a labeled disclosure with
   both tournament and live-race links. Official and provisional honours keep
   their existing meaning; no ratings or winners are invented.
4. **A long stack of disconnected award cards.** Categories now share a
   divided surface, with internal boundaries and an inset keyboard focus ring.
   Existing category destinations and earned-honour counts are preserved.
5. **Historical detail competing with current standings.** Personal rank
   history has its own keyboard-accessible disclosure. It still loads the
   selected player's real league/mode history and never fills missing dates
   with estimates. Current rankings and the Find My Rank action remain primary.
6. **Cramped typography and broken mobile controls.** Heading, player-name
   and score tracking is less compressed. Heading leading is more comfortable.
   Fixture filters reflow with screen size and 200% text, keep whole labels,
   expose `aria-pressed`, and retain 44px targets and visible focus. Scheduled
   status badges do not shrink into broken words.
7. **Auth polish and clarity.** Login uses sentence-case welcoming copy,
   theme-based help text, distinct input borders and visible keyboard focus.
   Social buttons retain readable provider labels and unbroken availability
   text. DOB/WhatsApp requirements and the existing authentication behavior
   remain intact. Unconfigured providers are still accurately marked Coming soon.
8. **Unreliable feature background fallback.** Featured navy heroes now
   declare a solid backing color as well as their image/gradient. Editorial
   headers use solid theme ink. Forced-color text fill, reduced motion and
   saved club palettes remain supported. Identity crests on fixtures and
   podiums use readable surface/text roles.

## Verification

The source audit includes production-build browser review rather than a
subjective numerical design score. Inspected screenshots cover populated
dashboard, league, tournament, match, awards, seasonal ranking, fixtures,
analytics, public tournament, player identity, standings, brackets and League
War screens on mobile and desktop. Additional focused checks cover login,
profile, leaderboards and Golden Boot in light and dark modes.

- Production Webpack build and web lint.
- 29 relevant source regression checks for dashboard context, awards
  discovery, ranking history, qualification integrity and the design layer.
- 42 hierarchy browser cases: seven routes at 320/390/1280px in light/dark,
  including real controls, team dialog identity, unchanged ratings,
  disclosures, login help contrast, focus and zero unexpected API writes.
- 28 populated route/viewport cases across fourteen screens, with no masthead
  contrast findings, horizontal overflow, route exceptions or unexpected writes.
- The existing theme suite covers mobile/tablet/desktop, twelve club palettes,
  both modes, 200% text, high contrast, keyboard and touch targets.
- Existing dashboard-state, Next Match, awards/ranking, social-login,
  independent DUO game-save and Top 12 playoff browser regressions remain gates.
- The hierarchy suite is included in Frontend CI. The exact off-host artifact
  must additionally pass authenticated staging against disposable PostgreSQL
  and Redis before production activation.

## Release and recovery boundaries

This UI change does not alter API source, schema, migrations, ranking rules,
permissions, match results or tournament advancement. The candidate must have
schema/migration parity with production. Generated local Prisma files and the
unrelated dirty root checkout are excluded from the release commits.

Use the existing four-instance managed runtime activation with exact SHA and
health verification. Before switching, retain the previous runtime and static
assets, verify the fresh encrypted database/media backup on the owner's
approved private PC, and prove authenticated staging plus replica/Redis
behavior. Record the activated SHA, public browser results and recovery
receipt separately as deployment evidence. Authenticated production login is
omitted under the owner's existing staging-login plus public-check instruction.

## Remaining external dependencies and maintenance

Google/Meta OAuth application credentials have not been supplied; their
availability is not falsely presented as completed sign-in. The owner chose
the existing server plus private PC recovery, so this release does not claim
resilience to loss of the whole server. The older ordered stylesheet layers
remain technical debt: replace them only with broad visual parity evidence,
not as part of a hurried deployment. Visual taste remains open to owner
feedback even when functional and accessibility gates pass.

The extracted implementation guide is `.stitch/DESIGN.md`.
