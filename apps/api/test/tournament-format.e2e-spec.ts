import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { ResultsService } from '../src/results/results.service.js';
import { PublicService } from '../src/public/public.service.js';
import { MatchesService } from '../src/matches/matches.service.js';
import { MatchRealtimeService } from '../src/matches/match-realtime.service.js';
import { loadTournamentFormatGuide } from '../src/tournaments/tournament-format-guide.js';

describe('Tournament format metadata with real PostgreSQL', () => {
  let db: PrismaService, owner: string, leagueId: string, cupId: string, matchId: string;
  const run = randomUUID().slice(0, 8);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Requires a disposable loopback *_test database.');
    db = new PrismaService(); await db.$connect();
    owner = (await db.user.create({ data: { email: `format-${run}@example.invalid`, fullName: 'Format Test', passwordHash: 'not-a-login-hash', status: 'ACTIVE' } })).id;
    leagueId = (await db.league.create({ data: { name: 'Format Test', code: `FMT${run}`, creatorUserId: owner } })).id;
    await db.leagueMember.create({ data: { leagueId, userId: owner, type: 'PRIMARY' } });
    await db.leagueAdmin.create({ data: { leagueId, userId: owner, role: 'OWNER' } });
    cupId = (await db.tournament.create({ data: { leagueId, createdByUserId: owner, name: 'Format Cup', code: `FMT${run}`, mode: 'SOLO', format: 'ROUND_ROBIN', competitionFormat: 'UCL_CUP', teamSize: 1, maxEntries: 36, visibility: 'PUBLIC' } })).id;
    await db.tournamentRegistration.createMany({ data: Array.from({ length: 13 }, (_, i) => ({ tournamentId: cupId, registeredByUserId: owner, entryName: `Club ${i}`, status: i === 12 ? 'PENDING' : 'APPROVED', sortOrder: i })) });
    const entries = await db.tournamentRegistration.findMany({ where: { tournamentId: cupId, status: 'APPROVED' }, orderBy: { sortOrder: 'asc' } });
    const fixture = await db.fixture.create({ data: { tournamentId: cupId, fixtureCode: `FMT-${run}-1`, sequence: 1, roundNumber: 1, bracketPosition: 1, roundName: 'Matchday 1', homeRegistrationId: entries[0].id, awayRegistrationId: entries[1].id } });
    matchId = (await db.match.create({ data: { tournamentId: cupId, fixtureId: fixture.id } })).id;
  }, 30000);
  afterAll(async () => {
    if (leagueId) await db.league.delete({ where: { id: leagueId } });
    if (owner) await db.user.delete({ where: { id: owner } });
    await db?.$disconnect();
  });

  it('returns the same approved-only qualification counts on overview, standings, public page and match room', async () => {
    const auth = new AuthorizationService(db), realtime = new MatchRealtimeService();
    const overview = (await new TournamentsService(db, auth).getTournament(owner, cupId)).data.tournament.formatGuide;
    const standings = (await new ResultsService(db, auth, realtime).getStandings(owner, cupId)).data.tournament.formatGuide;
    const published = (await new PublicService(db).getTournament(`FMT${run}`)).data.tournament.formatGuide;
    const room = (await new MatchesService(db, realtime).getMatch(owner, matchId)).data.match.tournament.formatGuide;
    expect(overview).toMatchObject({ approvedEntries: 12, capacity: 36, qualification: { total: 12, direct: 4, playIn: 8 } });
    expect(standings).toEqual(overview); expect(published).toEqual(overview); expect(room).toEqual(overview);
  });

  it('counts only approved entries within each saved group', async () => {
    await db.tournament.update({ where: { id: cupId }, data: { competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS', qualifiersPerGroup: 3 } });
    const entries = await db.tournamentRegistration.findMany({ where: { tournamentId: cupId }, orderBy: { sortOrder: 'asc' } });
    for (let i = 0; i < 3; i++) {
      const group = await db.tournamentGroup.create({ data: { tournamentId: cupId, name: `Group ${i}`, position: i + 1 } });
      await db.tournamentRegistration.updateMany({ where: { id: { in: entries.slice(i * 4, i * 4 + 4).map(e => e.id) } }, data: { groupId: group.id } });
      if (i === 0) await db.tournamentRegistration.update({ where: { id: entries[12].id }, data: { groupId: group.id } });
    }
    expect(await loadTournamentFormatGuide(db, cupId)).toMatchObject({ groups: [{ entries: 4 }, { entries: 4 }, { entries: 4 }], qualification: { state: 'READY', total: 9, perGroup: 3, source: 'GROUP_QUALIFIERS' } });
  });

  it('does not expose a private tournament through the public endpoint', async () => {
    await db.tournament.update({ where: { id: cupId }, data: { visibility: 'PRIVATE' } });
    await expect(new PublicService(db).getTournament(`FMT${run}`)).rejects.toMatchObject({ status: 404 });
    await expect(new TournamentsService(db, new AuthorizationService(db)).getTournament(randomUUID(), cupId)).rejects.toMatchObject({ status: 403 });
  });
});
