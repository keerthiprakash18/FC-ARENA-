import { deduplicateFixtureRecords, isCanonicalCompletedFixture, type CanonicalFixtureLike } from '../tournaments/fixture-deduplication.js';
import { resultPlayerIds } from '../results/result-roster.js';
import { parseDuoGames } from '../results/duo-aggregate.js';

export interface FormFixture extends CanonicalFixtureLike {
  tournamentId: string;
  tournament: { competitionFormat: string; legType: string; duoAggregateEnabled: boolean };
  homeRegistration: { members: Array<{ userId: string }> } | null;
  awayRegistration: { members: Array<{ userId: string }> } | null;
  match: {
    status: string; confirmedResultSubmissionId: string | null;
    confirmedResult: { id: string; status: string; homeScore: number; awayScore: number;
      reviewedAt: Date | null; createdAt: Date; duoGames: unknown; statEvents: Array<{ payload: unknown }> } | null;
  } | null;
}

export function chronologicalLeagueForm(fixtures: FormFixture[], members: ReadonlySet<string>) {
  const byTournament = new Map<string, FormFixture[]>();
  for (const fixture of fixtures) {
    const group = byTournament.get(fixture.tournamentId) ?? [];
    group.push(fixture); byTournament.set(fixture.tournamentId, group);
  }
  const canonical = [...byTournament.values()].flatMap(group => deduplicateFixtureRecords(
    group.filter(isCanonicalCompletedFixture), group[0].tournament.competitionFormat, group[0].tournament.legType,
  ));
  canonical.sort((a,b) => {
    const first=a.match!.confirmedResult!, second=b.match!.confirmedResult!;
    return (first.reviewedAt ?? first.createdAt).getTime() - (second.reviewedAt ?? second.createdAt).getTime() || a.id.localeCompare(b.id);
  });
  const forms = new Map<string,string>();
  const record = (id: string, goals: number, conceded: number) => {
    if (members.has(id)) forms.set(id, ((forms.get(id) ?? '') + (goals === conceded ? 'D' : goals > conceded ? 'W' : 'L')).slice(-5));
  };
  for (const fixture of canonical) {
    const result = fixture.match!.confirmedResult!;
    if (fixture.tournament.duoAggregateEnabled) {
      for (const game of parseDuoGames(result.duoGames) ?? []) {
        record(game.homePlayerId,game.homeGoals,game.awayGoals);record(game.awayPlayerId,game.awayGoals,game.homeGoals);
      }
    } else {
      for (const id of resultPlayerIds(result,'home',fixture.homeRegistration?.members ?? [])) record(id,result.homeScore,result.awayScore);
      for (const id of resultPlayerIds(result,'away',fixture.awayRegistration?.members ?? [])) record(id,result.awayScore,result.homeScore);
    }
  }
  return forms;
}
