# FC Arena UI/UX — Phase 4

## Scope and outcome

Phase 4 starts from Phase 3 checkpoint `f6e093c`. Interaction feedback uses
160ms opacity/color/border transitions, visible busy text and semantic live
regions. There are no new animation dependencies, route-delay effects or idle
decorative animations. Only an actively busy action's small indicator rotates;
reduced-motion and native Android show a static indicator and the same text.

## Improvements

- Added a small `FcActionButton` for disabled/busy semantics, short busy labels
  and an optional activity indicator. Confirmation submit buttons share it.
- Copy code and share invite show immediate busy feedback and contextual success
  or error notices; buttons stay disabled during the action. QR generation keeps
  its lazy-loaded library and gets a short reveal and readable state.
- Player/match share cards expose preparation feedback and download/share outcome.
  The existing PNG construction and native-share/download paths remain intact.
- Tournament logo upload exposes real numeric progress with a native progressbar,
  an accessible chooser label, busy state, validation errors and success/removal
  announcements. Existing file types, size limits, multipart field and rollback
  behavior remain intact.
- Shared navigation/actions have bounded color/border feedback, table/standing
  rows have a restrained desktop hover treatment, and bracket rounds expose their
  names and a focus-within boundary. Scores, rankings and brackets do not animate
  or reorder on their own.
- Dialog/search/reveal/notice effects are opacity-only and short. All new motion
  is disabled for reduced motion and native Android before the existing native
  safe-area/performance stylesheet, which remains imported last.

## Exact change inventory

- `apps/web/src/app/interactions.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx`
- `apps/web/src/components/fc/fc-action-button.tsx`
- `apps/web/src/components/fc/fc-dialog.tsx`
- `apps/web/src/components/fc/league-invite.tsx`
- `apps/web/src/components/fc/share-card.tsx`
- `apps/web/src/components/tournaments/tournament-logo-upload.tsx`
- `apps/android/tests/phase-ui-fixtures.mjs`
- `apps/android/tests/phase-ui-harness.mjs`
- `apps/android/tests/phase4-ui.mjs`
- `docs/UI-PHASE-4.md`

## Validation gate

- Web TypeScript: passed. Production build: passed, 62 static routes generated.
- Full web ESLint: 0 errors, 160 existing warnings.
- API Vitest: 152 tests across 26 files passed. Node regressions: 22 passed.
- Phase 4: 15 viewport/profile combinations passed: 360, 390, 768, 1024 and
  1440px in normal web motion, reduced-motion and Android-UA modes.
- Covered busy/disabled state, clipboard success/failure, code value, QR reveal/
  dismissal, share-card PNG download, bracket filtering, invalid upload with no
  request, valid multipart upload/progress/success and removal-confirmation cancel
  with no delete request. No page errors, unexpected API traffic, horizontal
  overflow or settled idle animations remained.
- Reran Phase 1 (3 widths), Phase 2 (4), Phase 3 (5), general UI smoke (91 checks)
  and Android-UA smoke (48 checks): all passed after Phase 4.
- All browser content came from the local production server; APIs were mocked.

## Review and limitations

Review confirms the payloads, permissions and competition calculations were not
changed. No package/dependency, native Java, database or infrastructure changes
are included. Existing protected working-tree changes remain unstaged. Physical
Android/TalkBack, device share sheets, soft-keyboard, inset and lifecycle behavior
still need manual validation. Phase 4 passes the local gate for Phase 5.
