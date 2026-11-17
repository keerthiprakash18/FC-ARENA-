import { describe, expect, it } from 'vitest';
import { rankVerifiedScores } from './verified-score-races.js';

const tournament = {
  competitionFormat: 'ROUND_ROBIN',
  legType: 'SINGLE',
  duoAggregateEnabled: false,
};
const games = [
  { homePlayerId: 'h1', awayPlayerId: 'a1', homeGoals: 4, awayGoals: 0 },
  { homePlayerId: 'h2', awayPlayerId: 'a2', homeGoals: 1, awayGoals: 3 },
];
const fixture = {
  id: 'fixture-1',
  sequence: 1,
  homeRegistrationId: 'home',
  awayRegistrationId: 'away',
  status: 'COMPLETED',
  match: {
    status: 'COMPLETED',
    confirmedResultSubmissionId: 'result-1',
    confirmedResult: {
      id: 'result-1', status: 'CONFIRMED', homeScore: 5, awayScore: 3, duoGames: games,
    },
  },
};

describe('verified score award races', () => {
  it('counts a legacy team score once and excludes unverified fixtures', () => {
    const duplicate = { ...fixture, id: 'duplicate', sequence: 2 };
    const pending = { ...fixture, id: 'pending', awayRegistrationId: 'other', status: 'SCHEDULED' };
    const ranks = rankVerifiedScores([fixture, duplicate, pending], tournament);
    expect(ranks.goldenBoot).toMatchObject([
      { userId: 'home', goalsFor: 5, matches: 1 },
      { userId: 'away', goalsFor: 3, matches: 1 },
    ]);
  });

  it('credits verified Duo goals and clean sheets to the player who earned them', () => {
    const ranks = rankVerifiedScores([fixture], { ...tournament, duoAggregateEnabled: true });
    expect(ranks.goldenBoot).toMatchObject([
      { userId: 'h1', goalsFor: 4 },
      { userId: 'a2', goalsFor: 3 },
      { userId: 'h2', goalsFor: 1 },
    ]);
    expect(ranks.goldenGlove[0]).toMatchObject({ userId: 'h1', cleanSheets: 1 });
  });

  it('leaves individual races empty for results without individual games', () => {
    const legacy = {
      ...fixture,
      match: { ...fixture.match, confirmedResult: { ...fixture.match.confirmedResult, duoGames: null } },
    };
    const ranks = rankVerifiedScores([legacy], { ...tournament, duoAggregateEnabled: true });
    expect(ranks.goldenBoot).toEqual([]);
    expect(ranks.goldenGlove).toEqual([]);
  });
});
