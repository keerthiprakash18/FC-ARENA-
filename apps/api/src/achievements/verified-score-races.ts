import { rankGoldenBootRace, rankGoldenGloveRace, type AwardMetricRow } from './award-scoring.js';
import { parseDuoGames } from '../results/duo-aggregate.js';
import {
  deduplicateFixtureRecords,
  isCanonicalCompletedFixture,
  type CanonicalFixtureLike,
} from '../tournaments/fixture-deduplication.js';

interface ScoredFixture extends CanonicalFixtureLike {
  match: {
    status: string;
    confirmedResultSubmissionId: string | null;
    confirmedResult: {
      id: string;
      status: string;
      homeScore: number;
      awayScore: number;
      duoGames: unknown;
    } | null;
  } | null;
}

export function rankVerifiedScores(
  fixtures: ScoredFixture[],
  tournament: { competitionFormat: string; legType: string; duoAggregateEnabled: boolean },
) {
  const scores = new Map<string, AwardMetricRow>();
  const record = (id: string, scored: number, conceded: number) => {
    const row = scores.get(id) ?? {
      userId: id,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      cleanSheets: 0,
      bigMatchPoints: 0,
      longestWinStreak: 0,
    };
    row.matches++;
    row.wins += Number(scored > conceded);
    row.draws += Number(scored === conceded);
    row.losses += Number(scored < conceded);
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
    row.goalDifference += scored - conceded;
    row.cleanSheets += Number(conceded === 0);
    scores.set(id, row);
  };

  const confirmed = deduplicateFixtureRecords(
    fixtures.filter(isCanonicalCompletedFixture),
    tournament.competitionFormat,
    tournament.legType,
  );
  for (const fixture of confirmed) {
    const result = fixture.match?.confirmedResult;
    if (!result || !fixture.homeRegistrationId || !fixture.awayRegistrationId) continue;

    if (tournament.duoAggregateEnabled) {
      for (const game of parseDuoGames(result.duoGames) ?? []) {
        record(game.homePlayerId, game.homeGoals, game.awayGoals);
        record(game.awayPlayerId, game.awayGoals, game.homeGoals);
      }
    } else {
      record(fixture.homeRegistrationId, result.homeScore, result.awayScore);
      record(fixture.awayRegistrationId, result.awayScore, result.homeScore);
    }
  }

  const rows = [...scores.values()];
  return {
    ids: [...scores.keys()],
    // Full canonical verified metrics for official awards at tournament finalisation.
    // The public races below remain capped at 20; official winners must not be.
    metrics: rows,
    goldenBoot: rankGoldenBootRace(rows).slice(0, 20),
    goldenGlove: rankGoldenGloveRace(rows).slice(0, 20),
  };
}
