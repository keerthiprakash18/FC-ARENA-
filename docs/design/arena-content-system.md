# FC ARENA content system (UX/audit 2026-11-18)

**Brand:** FC ARENA (uppercase in visible product identity)  
**Promise:** PLAY · COMPETE · BELONG  
**Voice:** competitive, clear, fair, respectful. No invented rankings, hype for incomplete data, or unsupported rewards.

## Product information hierarchy

1. **Next action:** play / submit / review match.
2. **Official state:** verified scores, points table, eligible qualifiers, bracket stage.
3. **Progress:** matches completed / total; Ballon eligibility.
4. **History:** confirmed honours and published reports.
5. **Advanced tools:** collapsed or permission-scoped. Never make destructive actions a prominent CTA.

## Approved terminology

| Situation | Label | Do not say |
| --- | --- | --- |
| All teams play in one table | Single-Table League | Group 0 |
| League with knockout trophy | League + Playoffs | League Winner by Points |
| Qualifiers before stage ends | Qualification position | Qualified |
| Authenticated result upload | Result submitted · awaiting verification | Final score |
| Confirmed result | Verified result | Pending |
| Active award race | Provisional award race | Official winner |
| Finalised championship | Official champion | Current leader |
| Verified personal goals | Individual Golden Boot | Team score becomes personal goals |
| Team aggregate goals | Team Golden Boot race | Player Golden Boot |
| Best defensive clean sheets | Golden Glove · Best Defensive Record | Best goalkeeper (without saves data) |
| Seasonal award | FC ARENA Ballon d’Or | Rank #0 |
| Rank not yet eligible | Not yet eligible · X/Y matches | Rank #0 |

## States every competition component must support

**DRAFT** → **OPEN / ACTIVE** → **RESULTS PENDING** → **LEAGUE VERIFIED** → **KNOCKOUT VERIFIED** → **OFFICIAL / ARCHIVED**.

Visibility rules:
- **Overview**: tournament format + playoff format only once. Show actual progress.
- **Standings**: official points table first; PTS clear, provisional cutoff distinct from final qualifying list.
- **Bracket**: show only for knockout-capable competition.
- **Honours**: show live races and official awards separately. An award is official only after completed tournament verification.
- **Admin**: destructive actions behind named confirmation and server guards.

## Awards eligibility policy (new finals)

- SOLO: official Golden Boot, Golden Glove and Player of the Tournament from verified individual match statistics.
- DUO with verified per-player `duoGames`: official **individual** Golden Boot and Golden Glove, and Player of the Tournament after at least three verified individual games. No fabricated player awards if individual scores are absent.
- DUO / TEAM without verified personal goals: team awards/races only; label `TEAM` in the UI and maintain separate records for team-level trophies before adding public team trophies.
- Golden Glove is a defensive clean-sheet honour, *not goalkeeper saves*. At least one verified clean sheet required for an official recipient.
- Ballon: eligibility requirements frozen after a season starts; new open quick-start seasons do not require each player to join every game mode. The ranking shows reasons before qualification.

## Regression gate

Require tests for:
1. 20 teams, 190 stage fixtures → top 8 playoffs; final winner, not league #1, takes trophy.
2. No published playoff bracket blocks tournament finalisation.
3. Direct knockout and legacy round-robin behaviour unchanged.
4. Only approved participants with canonical per-player verified Duo games get individual awards.
5. No zero-clean-sheet Golden Glove, no unsupported assist award.
6. Mobile (360, 390, 412, 430px) and desktop: five primary navigation destinations, secondary tools discoverable, PTS visible, no horizontal layout break.
7. Role-scoped settings/admin links; backend permissions continue to be authoritative.
8. Live Web/API release fingerprints, backups, isolated restore, rollback before activation.

**Safety:** No automatic edits of production fixtures, entries, schedules, standings or historical award winners. Future schema changes require migration review, data backup and preflight sign-off.
