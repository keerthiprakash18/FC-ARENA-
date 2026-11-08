import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TournamentReportService } from './tournament-report.service.js';

const participant = (id: string) => ({ id, fullName: `Full ${id}`, email: 'private@example.invalid', player: { playerCode: id, profileImageUrl: '/media/avatar.webp', identity: { inGameName: `Player ${id}` } } });
const registration = (id: string, groupId: string | null = 'group-a') => ({ id, entryName: `Team ${id}`, entryLogoUrl: '/media/team.webp', groupId, members: [{ user: participant(id) }] });
const fixture = (id: string, home = 'a', away = 'b', score = [2, 1]) => ({ id, tournamentId: 'cup', fixtureCode: id.toUpperCase(), groupId: 'group-a', sequence: 1, roundNumber: 1, roundName: 'Round 1', bracketPosition: 1, phase: 'STAGE', matchday: 1, scheduledAt: new Date('2026-11-01T10:00:00Z'), status: 'COMPLETED', homeRegistrationId: home, awayRegistrationId: away,
  match: { id: 'match-' + id, status: 'COMPLETED', confirmedResultSubmissionId: 'result-' + id, confirmedResult: { id: 'result-' + id, status: 'CONFIRMED', homeScore: score[0], awayScore: score[1], homePenaltyScore: null as number | null, awayPenaltyScore: null as number | null, reviewedAt: new Date('2026-11-01T11:00:00Z') } } });
function setup() {
  const tournament = { id: 'cup', leagueId: 'league', name: 'Final cup', code: 'FINAL-CUP', description: 'Competition', logoUrl: '/media/cup.webp', mode: 'SOLO', format: 'ROUND_ROBIN', competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS', legType: 'SINGLE_LEG', teamSize: 1, status: 'COMPLETED', startAt: null, endAt: null, completedAt: new Date('2026-11-02T12:00:00Z'), league: { id: 'league', name: 'FC Arena', code: 'FCA', logoUrl: null } };
  const db = { tournament: { findUnique: vi.fn().mockResolvedValue(tournament) }, leagueMember: { findUnique: vi.fn().mockResolvedValue({ id: 'member' }) },
    tournamentRegistration: { findMany: vi.fn().mockResolvedValue([registration('a'), registration('b')]), count: vi.fn().mockResolvedValue(3) },
    tournamentGroup: { findMany: vi.fn().mockResolvedValue([{ id: 'group-a', name: 'Group A' }]) }, fixture: { findMany: vi.fn().mockResolvedValue([fixture('first')]) },
    achievement: { findMany: vi.fn().mockResolvedValue([{ id: 'award', type: 'BEST_PLAYER', title: 'Player of the Tournament', description: 'Best performance', awardedAt: new Date('2026-11-02T12:00:00Z'), metadata: { privateProof: 'not-exported' }, user: participant('b') }]) } };
  const row = (id: string, position: number, points: number) => ({ registrationId: id, position, played: 1, wins: points ? 1 : 0, draws: 0, losses: points ? 0 : 1, goalsFor: points ? 2 : 1, goalsAgainst: points ? 1 : 2, goalDifference: points ? 1 : -1, points, form: points ? 'W' : 'L' });
  const results = { getStandings: vi.fn().mockResolvedValue({ data: { standings: [row('a', 1, 3), row('b', 2, 0)] } }) };
  const achievements = { getTournamentSummary: vi.fn().mockResolvedValue({ data: { summary: { placements: { champion: { registrationId: 'b', name: 'Published champion', members: [{ userId: 'b', name: 'Historical champion', email: 'not-exported' }] }, runnerUp: { registrationId: 'a', name: 'Published runner up' }, thirdPlace: [] }, privateProof: 'not-exported' }, publishedAt: new Date('2026-11-02T12:00:00Z'), legacyDerived: false } }) };
  return { tournament, db, results, achievements, service: new TournamentReportService(db as never, achievements as never, results as never) };
}

describe('completed tournament full report', () => {
  it('exports all approved rosters before completion while reporting pending applicants separately', async () => {
    const f = setup(); f.tournament.status = 'REGISTRATION_OPEN';
    const report = await f.service.getTeamList('member', 'cup');
    expect(report.overview).toEqual({ teams: 2, players: 2, groups: 1, pending: 3 });
    expect(report.teams[0]).toMatchObject({ name: 'Team a', groupName: 'Group A', members: [{ name: 'Player a' }] });
    expect(report.tournament.completedAt).toBe('2026-11-02T12:00:00.000Z');
    expect(f.db.tournamentRegistration.findMany.mock.calls[0][0].where).toEqual({ tournamentId: 'cup', status: 'APPROVED' });
    expect(f.db.fixture.findMany).not.toHaveBeenCalled(); expect(f.achievements.getTournamentSummary).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain('private@example');
    f.db.tournamentRegistration.findMany.mockResolvedValue([]);
    await expect(f.service.getTeamList('member', 'cup')).rejects.toMatchObject({ status: 409, response: { error: { code: 'TEAM_LIST_EMPTY' } } });
    f.db.leagueMember.findUnique.mockResolvedValue(null);
    await expect(f.service.assertTeamListAccess('outsider', 'cup')).rejects.toMatchObject({ status: 403 });
  });
  it('requires league membership before reading any report rows and rejects incomplete tournaments', async () => {
    const f = setup(); f.db.leagueMember.findUnique.mockResolvedValue(null);
    await expect(f.service.getReport('stranger', 'cup')).rejects.toMatchObject({ status: 403 });
    expect(f.db.fixture.findMany).not.toHaveBeenCalled(); expect(f.results.getStandings).not.toHaveBeenCalled();
    f.db.leagueMember.findUnique.mockResolvedValue({ id: 'member' }); f.tournament.status = 'ACTIVE';
    await expect(f.service.getReport('member', 'cup')).rejects.toMatchObject({ status: 409, response: { error: { code: 'TOURNAMENT_REPORT_NOT_READY' } } });
    f.db.tournament.findUnique.mockResolvedValue(null);
    await expect(f.service.assertReportAccess('member', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('performs lightweight completion/access revalidation without materializing a report', async () => {
    const f = setup(); await f.service.assertReportAccess('member', 'cup');
    expect(f.db.fixture.findMany).not.toHaveBeenCalled(); expect(f.achievements.getTournamentSummary).not.toHaveBeenCalled();
  });
  it('uses published placements, canonical standings and projected public data rather than the best table row', async () => {
    const f = setup(), report = await f.service.getReport('member', 'cup');
    expect(report.placements.champion).toMatchObject({ id: 'b', name: 'Published champion', members: [{ id: 'b', name: 'Historical champion' }] });
    expect(report.standings[0]).toMatchObject({ kind: 'GROUP', rows: [{ entry: { id: 'a' }, points: 3 }, { entry: { id: 'b' }, points: 0 }] });
    expect(report.overview).toMatchObject({ teams: 2, players: 2, verifiedMatches: 1, totalGoals: 3 });
    expect(report.awards[0].player).toMatchObject({ name: 'Player b', playerCode: 'b' });
    expect(JSON.stringify(report)).not.toMatch(/private@example|not-exported|metadata|privateProof|password/);
  });
  it('excludes stale/unconfirmed scores and deduplicates old fixtures without losing cancelled fixtures or byes', async () => {
    const f = setup(), stale = fixture('stale', 'a', 'c', [99, 99]); stale.match.confirmedResult.id = 'wrong-pointer';
    const duplicate = fixture('duplicate'); duplicate.sequence = 2;
    const cancelled = { ...fixture('cancelled', 'b', 'c'), groupId: 'other', status: 'CANCELLED', match: null };
    const bye = { ...fixture('bye'), groupId: null, phase: 'PLAYOFF', homeRegistrationId: 'a', awayRegistrationId: null, match: null };
    f.db.fixture.findMany.mockResolvedValue([fixture('first'), duplicate, stale, cancelled, bye]);
    const report = await f.service.getReport('member', 'cup');
    expect(report.matches.find(match => match.id === 'stale')?.score).toBeNull();
    expect(report.overview).toMatchObject({ fixtures: 4, verifiedMatches: 1, cancelledFixtures: 1, byes: 1, totalGoals: 3 });
    expect(report.matches.find(match => match.id === 'bye')?.status).toBe('BYE');
    expect(report.integrity.omittedUnconfirmedScores).toBe(1);
    expect(report.integrity.duplicateFixturesRemoved).toBe(1);
    // Unknown/deleted registrations are not fabricated into an opponent identity.
    expect(report.matches.find(match => match.id === 'stale')?.away).toBeNull();
    expect(report.teamPerformance.find(row => row.entry.id === 'a')).toMatchObject({ played: 1, wins: 1, goalsFor: 2 });
  });
  it('carries verified UCL return-leg aggregates and penalties without removing the first leg', async () => {
    const f = setup(); f.tournament.competitionFormat = 'UCL_CUP'; f.tournament.legType = 'HOME_AWAY'; f.tournament.format = 'KNOCKOUT';
    f.db.tournamentGroup.findMany.mockResolvedValue([]);
    const first = { ...fixture('leg-one', 'a', 'b', [1, 0]), groupId: null, phase: 'PLAYOFF', roundName: 'UCL Semi-Final' };
    const second = { ...fixture('leg-two', 'b', 'a', [1, 0]), groupId: null, phase: 'PLAYOFF', roundName: 'UCL Semi-Final', matchday: 2, sequence: 2 };
    second.match.confirmedResult.homePenaltyScore = 4; second.match.confirmedResult.awayPenaltyScore = 5;
    f.db.fixture.findMany.mockResolvedValue([first, second]);
    const report = await f.service.getReport('member', 'cup');
    expect(report.matches).toHaveLength(2); expect(report.standings).toEqual([]);
    expect(report.matches[1]).toMatchObject({ aggregate: { home: 1, away: 1, firstLegFixtureCode: 'LEG-ONE' }, score: { homePenalties: 4, awayPenalties: 5 } });
    expect(report.overview.totalGoals).toBe(2);
  });
  it('does not manufacture placements for a legacy conflict and does not suppress unrelated database failures', async () => {
    const f = setup(); f.achievements.getTournamentSummary.mockRejectedValue(new ConflictException('Missing final'));
    const report = await f.service.getReport('member', 'cup');
    expect(report.placements).toMatchObject({ source: 'UNAVAILABLE', champion: null }); expect(report.matches).toHaveLength(1);
    f.achievements.getTournamentSummary.mockRejectedValue(new Error('Database unavailable'));
    await expect(f.service.getReport('member', 'cup')).rejects.toThrow('Database unavailable');
  });
  it('returns the complete roster and player performance without a top-20 truncation or invented individual scorers', async () => {
    const f = setup(); f.tournament.mode = 'TEAM';
    f.db.tournamentRegistration.findMany.mockResolvedValue(Array.from({ length: 27 }, (_, i) => registration('team-' + i)));
    f.db.fixture.findMany.mockResolvedValue([]); f.results.getStandings.mockResolvedValue({ data: { standings: [] } });
    const report = await f.service.getReport('member', 'cup');
    expect(report.teams).toHaveLength(27); expect(report.players).toHaveLength(27); expect(report.players.every(row => row.matches === 0)).toBe(true);
    expect(report.integrity.warnings.some(warning => warning.includes('individual goal scorers'))).toBe(true);
    expect(f.db.tournamentRegistration.findMany.mock.calls[0][0]).not.toHaveProperty('take');
  });
});
