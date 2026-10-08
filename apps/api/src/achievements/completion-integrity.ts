import { ConflictException } from '@nestjs/common';
import { canonicalizeRoundRobinStandingsFixtures, type StandingsFixtureLike } from '../results/standings-integrity.js';
import { isCanonicalCompletedFixture } from '../tournaments/fixture-deduplication.js';

export function assertRoundRobinComplete(
  tournament: { format: string; competitionFormat: string; legType: string },
  registrations: Array<{ id: string; groupId: string | null }>,
  fixtures: Array<StandingsFixtureLike & { status: string; match: {
    status: string; confirmedResultSubmissionId: string | null;
    confirmedResult: { id: string; status: string } | null;
  } | null }>,
): void {
  if (tournament.format === 'KNOCKOUT' || tournament.competitionFormat === 'CUSTOM_MANUAL') return;
  const hasGroups = registrations.some((row) => row.groupId !== null);
  const counts = new Map<string, number>();
  for (const registration of registrations) {
    const scope = hasGroups ? registration.groupId ?? '__UNASSIGNED__' : '__LEAGUE__';
    counts.set(scope, (counts.get(scope) ?? 0) + 1);
  }
  const legs = tournament.competitionFormat === 'DOUBLE_ROUND_ROBIN' || tournament.legType === 'HOME_AWAY' ? 2 : 1;
  const expected = [...counts.values()].reduce((sum, count) => sum + count * (count - 1) / 2 * legs, 0);
  const completed = canonicalizeRoundRobinStandingsFixtures(fixtures.filter(isCanonicalCompletedFixture), registrations, {
    competitionFormat: tournament.competitionFormat, legType: tournament.legType,
    tournamentFormat: tournament.format, hasGroups,
  });
  if (completed.length !== expected || counts.has('__UNASSIGNED__')) {
    throw new ConflictException({ success: false, data: null, error: {
      code: 'TOURNAMENT_MATCHES_INCOMPLETE', message: 'Every configured Round Robin pairing and leg must have a confirmed result before completion.',
    } });
  }
}
