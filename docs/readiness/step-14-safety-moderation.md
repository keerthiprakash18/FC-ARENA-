# Step 14 — User Safety and Moderation

Status: implementation ready; accepted when API/web tests are green.

## User controls

FC ARENA supports report, block and unblock flows. Reporting prevents self-reporting and is rate-limited. Categories include harassment/bullying, hate/abuse, sexual content/nudity, graphic violence, spam/scam, impersonation, inappropriate profile and other.

Blocks are evaluated in both directions for supported interaction controls. Competition history is not silently rewritten by a block.

## Moderation controls

- Only SUPER_ADMIN can read or act on the moderation queue.
- Reports are immutable audit events.
- Moderators can explicitly Resolve or Dismiss a report.
- Resolution/dismissal notes and timestamps remain auditable.
- The queue exposes how many reports have been submitted against the same target to help identify repeat patterns.
- Report count is context only: FC ARENA does not automatically punish a user solely because reports were submitted.
- Users can view their own submitted report status.

Unit tests cover moderation authorization, explicit dismissed outcomes and self-report prevention.
