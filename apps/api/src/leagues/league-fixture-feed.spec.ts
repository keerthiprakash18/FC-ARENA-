import { describe, expect, it, vi } from 'vitest';
import { LeagueFixtureFeedService } from './league-fixture-feed.service.js';

function fixture(count = 1) {
  const entry = (id: string) => ({ id, entryName: `Club ${id}`, entryLogoUrl: 'https://example.invalid/club.png',
    members: [{ user: { id: `user-${id}`, fullName: `Player ${id}`, email: 'private@example.invalid',
      player: { playerCode: `P${id}`, identity: { inGameName: `FC ${id}`, gameUid: 'private-id' } } } }] });
  const rows = Array.from({ length: count }, (_, i) => ({ id: `fixture-${i}`, fixtureCode: `F${i}`, tournamentId: `cup-${i}`,
    sequence: 1, roundNumber: 1, roundName: 'Matchday 1', phase: 'STAGE', matchday: 1, status: 'SCHEDULED', scheduledAt: null, venue: null,
    groupId: null, group: null, homeRegistrationId: `home-${i}`, awayRegistrationId: `away-${i}`,
    homeRegistration: entry(`home-${i}`), awayRegistration: entry(`away-${i}`),
    match: { id: `match-${i}`, matchCode: `M${i}`, status: 'SCHEDULED', confirmedResultSubmissionId: null, confirmedResult: null } }));
  const prisma = { leagueMember: { findUnique: vi.fn().mockResolvedValue({ league: { name: 'Arena League' } }) },
    tournament: { findMany: vi.fn().mockResolvedValue(rows.map(row => ({ id: row.tournamentId, name: row.tournamentId, status: 'PUBLISHED', competitionFormat: 'UCL_CUP', legType: 'SINGLE_LEG' }))) },
    fixture: { findMany: vi.fn().mockResolvedValue(rows) } };
  return { service: new LeagueFixtureFeedService(prisma as never), prisma, rows };
}

describe('League fixture feed', () => {
  it.each([1, 20])('uses a fixed query budget for %i tournaments and exposes only the roster projection', async count => {
    const f = fixture(count), response = await f.service.getFeed('member', 'league');
    if (response.data.unchanged) throw new Error('Initial feed must include the schedule.');
    expect(f.prisma.leagueMember.findUnique).toHaveBeenCalledTimes(1);
    expect(f.prisma.tournament.findMany).toHaveBeenCalledTimes(1); expect(f.prisma.fixture.findMany).toHaveBeenCalledTimes(1);
    expect(response.data.fixtures).toHaveLength(count); expect(Object.keys(response.data.entries!)).toHaveLength(count * 2);
    expect(response.data.entries!['home-0'].entryLogoUrl).toContain('club.png');
    expect(JSON.stringify(response)).not.toContain('private@example.invalid'); expect(JSON.stringify(response)).not.toContain('private-id');
    expect(f.prisma.fixture.findMany.mock.calls[0][0].where).toEqual({ tournament: { leagueId: 'league' } });
  });

  it('returns only a small version envelope when the schedule has not changed', async () => {
    const f = fixture(20), initial = await f.service.getFeed('member', 'league');
    const result = await f.service.getFeed('member', 'league', initial.data.version);
    expect(result.data).toEqual({ unchanged: true, version: initial.data.version });
    expect(JSON.stringify(result).length).toBeLessThan(120);
  });

  it('rechecks membership before accepting a known version', async () => {
    const f = fixture(), initial = await f.service.getFeed('member', 'league');
    f.prisma.leagueMember.findUnique.mockResolvedValueOnce(null);
    await expect(f.service.getFeed('member', 'league', initial.data.version)).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.fixture.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidates the version for readiness/status and roster edits', async () => {
    const f = fixture(), initial = await f.service.getFeed('member', 'league');
    f.rows[0].match.status = 'LIVE'; const changed = await f.service.getFeed('member', 'league', initial.data.version);
    expect(changed.data.unchanged).toBe(false); expect(changed.data.version).not.toBe(initial.data.version);
    f.rows[0].homeRegistration.members[0].user.player.identity.inGameName = 'New name';
    expect((await f.service.getFeed('member', 'league')).data.version).not.toBe(changed.data.version);
  });

  it('normalizes repeated rosters instead of downloading two copies for every fixture', async () => {
    const f = fixture();
    f.rows.push(...Array.from({ length: 7 }, (_, i) => ({ ...f.rows[0], id: `extra-${i}`, sequence: i + 2, roundNumber: i + 2, matchday: i + 2, phase: 'PLAYOFF' })));
    const response = await f.service.getFeed('member', 'league');
    if (response.data.unchanged) throw new Error('Initial feed must include the schedule.');
    expect(response.data.fixtures).toHaveLength(8); expect(Object.keys(response.data.entries!)).toHaveLength(2);
  });

  it('validates version input without passing arbitrary data into the query', async () => {
    const f = fixture(); await expect(f.service.getFeed('member', 'league', 'bad-version')).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.leagueMember.findUnique).not.toHaveBeenCalled();
  });
});
