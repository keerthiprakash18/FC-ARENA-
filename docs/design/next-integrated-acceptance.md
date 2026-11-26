# FC ARENA NEXT — integrated development acceptance

This is a development checklist, not a production release approval. The full redesign remains larger than the currently reviewed changes.

| Phase | Evidence / implementation | Remaining acceptance |
|---|---|---|
| 3 Design system | #222 all-theme source-token contrast and visual baseline | Rendered contrast, responsive interaction states, complete shared UI review |
| 4 Home/navigation/profile | #223 career metric layout and browser regression | Remaining profile and navigation design acceptance |
| 5 Tournament/match | #225 publication race protection | Full match and tournament design implementation and operator workflow review |
| 6 Awards/career | #220 canonical weekly progress, with fallback | Awards and career visual acceptance beyond weekly activity |
| 7 Admin/community | #226 queue read snapshot | Admin and community visual and workflow review |
| 8 Engagement | Existing invite and activity metrics; added IST cohort and unique-account PostgreSQL test (#227) | Measure real baseline, verify engagement goals and remaining UX |
| 9 Performance/security | Existing PG17 CI alignment, #224 bounded Redis read pipeline | Full security and performance review, actual p95 and vitals measurement |
| 10 Integrated acceptance | This candidate is evaluated by existing CI | Exact main artifact, Android real-device verification, read-only production preflight and recovery proof, rollback, explicit approval |

## Integration strategy
The pending telemetry and engagement tests are included together in this candidate. Their individual backend workflow runs were cancelled while queued because every branch shared a global concurrency group. The backend workflow is CI-only, using isolated local PostgreSQL/Redis services, and is now grouped by PR or ref to avoid unrelated cancellations. No production deployment workflow is added.

A pinned Next.js guidance evidence step makes the installed framework's actual authoring guides accessible from the existing CI runner. It logs only package documentation from node_modules, not environment or application data. The authoring instructions remain in force.

No database migration, schema edit, production environment modification, reward rule change, live cleanup or auto-deployment is included.

## Production release gate
Do not treat this checklist or a green PR as release approval. Freeze a single reviewed main SHA; verify exact off-host build, independent recovery of DB and media, live WEB/API release identities, protected rollback, disk preflight, and authenticated role-based journeys. Record measured results and preserve existing tournament, match, award, player and upload data. GitHub branch protection still requires an authorized repository administrator.

## Evidence-driven UI follow-up
Review of the synthetic mobile screenshots from Actions run 45689087680 (390px) showed excessive pre-content controls on Career, an early result-draft notice above match identity, a long unsearchable More menu, and no quick jump from daily rewards to missions. Preserve Obsidian Matchday and all existing club theme roles rather than introduce a competing palette. This follow-up moves optional career shortcuts after statistics, adds a permission-filtered feature search from the original menu inventory, keeps match identity ahead of the noncritical draft message, and adds direct progression anchors. Tests must cover these behaviors without live mutations. Android swipe diagnostics are expanded without weakening the real gesture pass condition. Neither the screenshot review nor these source changes is evidence that the entire premium redesign or real-device acceptance is complete.
