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
  const playedFixtures = new Map<string, Set<string>>();
  const record = (id: string, scored: number, conceded: number, fixtureId: string) => {
    const fixtures = playedFixtures.get(id) ?? new Set<string>();
    fixtures.add(fixtureId);
    playedFixtures.set(id, fixtures);
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
        record(game.homePlayerId, game.homeGoals, game.awayGoals, fixture.id);
        record(game.awayPlayerId, game.awayGoals, game.homeGoals, fixture.id);
      }
    } else {
      record(fixture.homeRegistrationId, result.homeScore, result.awayScore, fixture.id);
      record(fixture.awayRegistrationId, result.awayScore, result.homeScore, fixture.id);
    }
  }

  const rows = [...scores.values()];
  return {
    ids: [...scores.keys()],
    fixtureMatches: new Map([...playedFixtures].map(([id, fixtures]) => [id, fixtures.size])),
    // Official individual awards continue to use verified games for eligibility
    // and tie-break rates; display fixture counts must not change those rules.
    // The race shows every participant with a confirmed result, including zero-goal
    // players/teams. Official winner eligibility remains unchanged elsewhere.
    metrics: rows,
    goldenBoot: rankGoldenBootRace(rows, { includeGoalless: true }),
    goldenGlove: rankGoldenGloveRace(rows),
  };
}
