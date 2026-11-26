# FC ARENA NEXT — execution and acceptance ledger

Updated: 26 November 2026 (Asia/Kolkata). This ledger records evidence, not release authorization.

## Source and preservation

- Integration: `integration/next-remaining-development`, PR #228, `ec3b26e72eac57ed66f46aac5d733f75c6a9cff0`.
- Follow-up: `codex/fc-arena-next-completion-20261126`; isolated worktree `.tmp-release/next-completion`.
- Original workspace remains on its existing branch with all pre-existing modifications preserved. It is 200 changed files and is unsuitable as a release source.
- GitHub main observed at `d67a7038e54c494b9e7d073ace55fdf84ae2d4a4`. Main is not the deployed identity.
- Baseline PR: all 12 workflow families succeeded, including Android API 33/34/35/36. The manually dispatched live/artifact readiness job was skipped on the pull-request run; its source contract alone passed.
- Invariants: preserve tournament rules, fixtures, results, standings, awards, XP, identities, accounts, chat, permissions, uploads, credentials and production configuration. No schema change, implicit migration, production cleanup or Android publication.

## Status vocabulary

`PENDING → IN PROGRESS → IMPLEMENTED → TESTED → VERIFIED`. A phase reaches VERIFIED only when its entire acceptance column has evidence. Individual improvements may pass while the containing phase remains IN PROGRESS.

| Phase | Status | Acceptance criteria | Evidence and remaining work |
| --- | --- | --- | --- |
| 1 Discovery and audit | IN PROGRESS | Reconcile latest source, shipped features, screenshots, player/admin journeys and prioritized defects; persist this ledger. | Current GitHub/source reconciliation complete; original working tree protected. Reviewing rendered fixtures and operational evidence. |
| 2 Safety foundation | IN PROGRESS | Preserve business/data/permission boundaries; run recovery, artifact, security and regression checks; remediate actual failures. | Existing PR gates green; follow-up local tests and exact release checks pending. |
| 3 Brand and design system | IN PROGRESS | Document canonical tokens, type, spacing, shared components and states; render light/dark and every club palette; keyboard/mobile/reduced-motion checks. | Existing Obsidian Matchday, Geist, semantic tokens and 408 source contrast comparisons retained. Rendered acceptance remains required. |
| 4 Core experience | IN PROGRESS | Verify Home, navigation, More, auth, profile, settings, notifications, Discover and public routes across responsive/empty/loading/error states. | Existing improvements retained. Discover stale search responses and Settings hierarchy are under implementation. |
| 5 Competitions | IN PROGRESS | Verify SOLO/DUO/TEAM, all formats and stages, registration, fixtures, score/OCR/verification, scheduling, standings and history without sporting-rule changes. | Existing playoff concurrency and match hierarchy fixes retained; fixture browser regression and full lifecycle evidence under review. |
| 6 Player identity and analytics | IN PROGRESS | Verify career/form/history, awards and eligibility, season scope, progression and real-data charts; preserve exact statistics/rewards. | Existing career meters, award screens and canonical weekly activity retained; all relevant rendered workflows still require acceptance. |
| 7 Admin and community | IN PROGRESS | Verify authorized operational queues, dispute/moderation/safety workflows and community scopes, feeds, polls/comments/reactions and failure recovery. | Existing queue snapshot consistency retained; reviewing audience changes and community recovery. |
| 8 Engineering/security/performance | IN PROGRESS | Verify auth/RBAC/validation/dependencies, request/render/database/Redis behavior and measured performance, accessibility and reconnection. | Baseline Security Hardening/CodeQL/load workflows green; raw metrics, scope and follow-up checks must be recorded. |
| 9 Meaningful engagement | IN PROGRESS | Verify existing missions, journey, achievements, relevant match actions, community and sharing; prevent invented metrics, reward exploits and duplicate features. | Existing weekly progress API and navigation retained; no new reward mechanism or unsupported statistics. |
| 10 Integrated acceptance/release | PENDING | After phases 2–9 acceptance: freeze reviewed SHA, pass final CI, exact immutable artifact/checksum, current WEB/API and host state, fresh DB+media restore, isolated staging, rollback, capacity and physical-device evidence where available; prepare guarded Windows operator command. | Read-only release investigation may proceed, but this phase is not entered and production activation is not authorized by a green PR. |

## Execution queue

- [x] Read attachment, current repository instructions, integration acceptance and VCL/recovery policies.
- [x] Recheck PR #228, integration/main heads and all workflow conclusions.
- [x] Create isolated branch/worktree without overwriting local work.
- [x] Discover available skills/MCP tools; use FC ARENA specialist workflows.
- [x] Correct Discover search cancellation/out-of-order/error recovery and test delayed responses.
- [x] Improve Settings navigation and grouping while retaining every existing preference/control.
- [x] Review community audience and loading/recovery interactions; fix reproduced draft-loss defects.
- [x] Run relevant local source/functional/browser/theme/security checks and reconcile measured inherited performance evidence; record scope and limitations.
- [x] Capture 32 matched synthetic before/after screenshots and document design decisions in `next-design-system.md` and the visual evidence ledger.
- [ ] Commit coherent changes, publish reviewable PR and wait for exact final CI.
- [ ] Verify public/host release identity, recovery freshness, capacity and guarded staging prerequisites.
- [ ] Rehearse exact final artifact and rollback when host gates permit.
- [ ] Complete release checklist and operator handoff; do not declare unfinished phases complete.

## Evidence locations

- Prior visual foundation: `docs/design/next-visual-baseline.md`.
- Prior integration scope: `docs/design/next-integrated-acceptance.md`.
- Follow-up QA: `docs/readiness/next-qa-evidence-20261126.md`.
- Follow-up release: `docs/readiness/next-release-handoff-20261126.md`.
- Private raw logs, full tool/skill inventory, artifacts and synthetic screenshots remain in workspace-local evidence folders, outside committed source. Never include private recovery contents or production user data.

## Resume contract

Read this ledger and the two follow-up evidence reports; check branch HEAD and GitHub before resuming. Next action: finish the concrete UI reliability fixes, run rendered acceptance against disposable fixtures, then update evidence and reviewable commits. No production mutation has been performed by this work.
