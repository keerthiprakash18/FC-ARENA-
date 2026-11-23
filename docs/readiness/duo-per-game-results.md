# Save individual Duo games before finishing a fixture

The fixtures inline editor and Match Room now save each individual game independently. Other games may remain blank. A saved 0–0 is a completed game; an unplayed game has no score. Saved games survive refresh and another device sees the same server state. An unsaved edit is retained across another game's save and across a failed request.

The running aggregate contains only saved games. An edited saved game replaces that pairing's previous score. Fixture W/D/L, points, player statistics and awards are applied once through the existing complete-result verification transaction, after all two/four games have been saved. Partial games never create a pending result or statistic event. Existing all-at-once clients remain supported when no per-game progress exists; they cannot overwrite saved progress with a different or incomplete snapshot.

Each game has an optimistic version. A lost-response retry of the same score is idempotent. Different pairings merge in serializable transactions; a stale edit to the same pairing returns 409 and preserves the editor's input. The editor reloads saved state and offers an explicit "Use saved score" action. It never automatically replays writes.

The existing participant/result-admin permissions apply. The API validates both team rosters, pairings, score bounds, open match status, pending/confirmed results and UCL return-leg access. Saved games lock when the complete fixture is pending verification. Correcting a verified result still uses the existing atomic correction path. Reversing a result clears unfinished game progress so reopening cannot reuse stale scores.

Storage uses the nullable `matches.duoGameProgress` JSONB column. Migration `20261123080000_duo_game_progress` only adds that column; existing rows/results are unchanged and older application code ignores it. Apply the migration before activating the new API. Do not drop the column during a code rollback. This feature's source changes and local/CI checks do not themselves deploy or mutate production.

Regression coverage includes 0–0, independent saves, persistence, edited totals, unauthorized/invalid requests, stale editors, concurrent different-game saves, pending/confirmed locks, one final statistics application and reversal. Browser checks exercise 320/390/1280 widths and the fixtures inline editor. PostgreSQL integration also preserves the legacy all-at-once four-game correction behavior.
