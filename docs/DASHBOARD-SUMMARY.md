# Dashboard summary

Home now loads the authenticated account and `/players/me/dashboard` concurrently, rather than downloading every league tournament's full fixture list. The guarded summary endpoint derives league IDs from the account's current memberships and filters fixtures by registration member account ID. Both primary and secondary leagues contribute matches.

Only open fixtures in non-draft, non-completed, non-cancelled tournaments are returned. Completed/cancelled linked matches are excluded. A fixed three fixture queries return up to ten future, ten unscheduled and ten overdue open fixtures, with deterministic ordering. Future fixtures come first. Up to twenty active competition summaries are returned. Full schedules remain available on Fixtures. Recent career results are limited to three for Home; the career endpoint retains its existing history limit.

Failures propagate to a dashboard error screen with an in-app Retry action. No partial failure is silently converted into an empty schedule. Updates are committed together after both account and summary requests succeed, and abandoned effects cannot overwrite current state.

Verification: API and web production builds passed; 103 API tests passed, including five dashboard regressions covering both-league/account scoping, fixed query limits, secondary-league fixture mapping, genuine empty schedules and failed query propagation. No production latency benchmark or authenticated physical-device test was performed.
