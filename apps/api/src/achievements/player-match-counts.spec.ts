import { describe, expect, it, vi } from 'vitest';
import { AchievementsService } from './achievements.service.js';
import { rankVerifiedScores } from './verified-score-races.js';

const tournament = { id: 'cup', leagueId: 'league', mode: 'DUO',
  competitionFormat: 'ROUND_ROBIN', legType: 'SINGLE_LEG', duoAggregateEnabled: true };

function fixture(index: number, player = 'player') {
  return {
    id: `fixture-${index}`, sequence: index, status: 'COMPLETED',
    homeRegistrationId: 'home-team', awayRegistrationId: `away-team-${index}`,
    match: { status: 'COMPLETED', confirmedResultSubmissionId: `result-${index}`,
      confirmedResult: { id: `result-${index}`, status: 'CONFIRMED', homeScore: 21, awayScore: 6,
        duoGames: [
          { homePlayerId: player, awayPlayerId: `opponent-a-${index}`, homeGoals: 2, awayGoals: 1 },
          { homePlayerId: player, awayPlayerId: `opponent-b-${index}`, homeGoals: 1, awayGoals: 0 },
          { homePlayerId: 'teammate', awayPlayerId: `opponent-a-${index}`, homeGoals: 11, awayGoals: 2 },
          { homePlayerId: 'teammate', awayPlayerId: `opponent-b-${index}`, homeGoals: 7, awayGoals: 3 },
        ],
      },
    },
  };
}

function serviceFor(fixtures: ReturnType<typeof fixture>[]) {
  const prisma = {
    tournament: { findUnique: vi.fn().mockResolvedValue(tournament) },
    leagueMember: { findUnique: vi.fn().mockResolvedValue({}) },
    fixture: { findMany: vi.fn().mockResolvedValue(fixtures) },
    user: { findMany: vi.fn().mockResolvedValue(['player', 'teammate', 'replacement'].map(id => ({ id, fullName: id, player: null }))) },
  };
  return { service: new AchievementsService(prisma as never, {} as never), prisma };
}

describe('individual DUO award match counts', () => {
  it('shows ten played fixtures separately from twenty own games and teammate goals', async () => {
    const fixtures = Array.from({ length: 10 }, (_, index) => fixture(index));
    const { service, prisma } = serviceFor(fixtures);
    expect(rankVerifiedScores(fixtures, tournament).metrics.find(row => row.userId === 'player'))
      .toMatchObject({ matches: 20, goalsFor: 30, cleanSheets: 10 });
    const response = await service.getTournamentAwardRaces('viewer', 'cup');
    const race = response.data.verifiedScoreRaces!;
    expect(race.scope).toBe('PLAYER');
    expect(race.goldenBoot.find(row => row.id === 'player')).toMatchObject({
      matches: 10, games: 20, goals: 30, goalsPerMatch: 3, goalsPerGame: 1.5,
    });
    expect(race.goldenGlove.find(row => row.id === 'player')).toMatchObject({
      matches: 10, games: 20, cleanSheets: 10, cleanSheetRate: 50, goalsAgainstPerMatch: 1, goalsAgainstPerGame: 0.5,
    });
    expect(race.goldenBoot.find(row => row.id === 'teammate')).toMatchObject({
      matches: 10, games: 20, goals: 180,
    });
    expect(prisma.fixture.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tournamentId: 'cup' }) }));
  });

  it('counts only the fixtures that player actually played, including roster replacements', async () => {
    const fixtures = Array.from({ length: 10 }, (_, index) => fixture(index, index === 9 ? 'replacement' : 'player'));
    const duplicate = { ...fixtures[0], id: 'duplicate', sequence: 20 };
    const pending = { ...fixture(99), status: 'SCHEDULED' };
    const { service } = serviceFor([...fixtures, duplicate, pending]);
    const race = (await service.getTournamentAwardRaces('viewer', 'cup')).data.verifiedScoreRaces!;
    expect(race.goldenBoot.find(row => row.id === 'player')).toMatchObject({ matches: 9, games: 18, goals: 27 });
    expect(race.goldenBoot.find(row => row.id === 'replacement')).toMatchObject({ matches: 1, games: 2, goals: 3 });
    expect(race.goldenBoot.find(row => row.id === 'teammate')).toMatchObject({ matches: 10, games: 20, goals: 180 });
  });

  it('retains verified game counts for official awards and supports two-game fixtures', async () => {
    const fixtures = Array.from({ length: 3 }, (_, index) => fixture(index));
    for (const row of fixtures) {
      row.match.confirmedResult.duoGames = row.match.confirmedResult.duoGames.filter((_, index) => index === 0 || index === 3);
    }
    const verified = rankVerifiedScores(fixtures, tournament);
    expect(verified.metrics.find(row => row.userId === 'player')).toMatchObject({ matches: 3, goalsFor: 6 });
    const { service } = serviceFor(fixtures);
    const race = (await service.getTournamentAwardRaces('viewer', 'cup')).data.verifiedScoreRaces!;
    expect(race.goldenBoot.find(row => row.id === 'player')).toMatchObject({ matches: 3, games: 3, goals: 6, goalsPerGame: 2 });
  });

  it('keeps aggregate team records measured in fixtures without individual-game fields', async () => {
    const { service, prisma } = serviceFor([fixture(0)]);
    prisma.tournament.findUnique.mockResolvedValue({ ...tournament, mode: 'TEAM', duoAggregateEnabled: false });
    Object.assign(prisma, { tournamentRegistration: { findMany: vi.fn().mockResolvedValue([
      { id: 'home-team', entryName: 'Home Team', members: [] },
      { id: 'away-team-0', entryName: 'Away Team', members: [] },
    ]) } });
    const race = (await service.getTournamentAwardRaces('viewer', 'cup')).data.verifiedScoreRaces!;
    expect(race.scope).toBe('TEAM');
    expect(race.goldenBoot[0]).toMatchObject({ id: 'home-team', matches: 1, goals: 21, goalsPerMatch: 21 });
    expect(race.goldenBoot[0]).not.toHaveProperty('games');
  });
});
