import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { TournamentEntriesService } from '../src/tournaments/tournament-entries.service.js';
import { TournamentFixtureWizardService } from '../src/tournaments/tournament-fixture-wizard.service.js';

describe('Flexible entry limits and fixture setup with real PostgreSQL', () => {
  let prisma: PrismaService;
  let tournaments: TournamentsService;
  let entries: TournamentEntriesService;
  let wizard: TournamentFixtureWizardService;
  let leagueId: string;
  let owner: string;
  const run = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('Requires an explicitly selected disposable loopback *_test database.');
    }
    prisma = new PrismaService();
    await prisma.$connect();
    const auth = new AuthorizationService(prisma);
    tournaments = new TournamentsService(prisma, auth);
    entries = new TournamentEntriesService(prisma, auth);
    wizard = new TournamentFixtureWizardService(prisma, auth);
    const user = await prisma.user.create({ data: { email: `flexible-${run}@example.invalid`, fullName: 'Test Owner',
      passwordHash: 'not-a-login-hash', status: 'ACTIVE' } });
    owner = user.id;
    const league = await prisma.league.create({ data: { name: `Flexible ${run}`, code: `FLEX${run}`, creatorUserId: owner } });
    leagueId = league.id;
    await prisma.leagueMember.create({ data: { leagueId, userId: owner, type: 'PRIMARY' } });
    await prisma.leagueAdmin.create({ data: { leagueId, userId: owner, role: 'OWNER' } });
  }, 30000);
  afterAll(async () => { await prisma?.$disconnect(); });

  async function createCup(count: number) {
    const { data } = await tournaments.createTournament(owner, leagueId, {
      name: `Capacity ${count} ${run}`, mode: 'SOLO', competitionFormat: 'UCL_CUP', maxEntries: 24,
    });
    const id = data.tournament.id;
    await prisma.tournamentRegistration.createMany({ data: Array.from({ length: count }, (_, i) => ({
      tournamentId: id, registeredByUserId: owner, entryName: `Club ${i}`, status: 'APPROVED', sortOrder: i,
    })) });
    await tournaments.openRegistration(owner, id);
    return id;
  }

  it('removes one of 23 entries, reduces 24 to 22, then generates all 22-team fixtures', async () => {
    const id = await createCup(23);
    await expect(tournaments.updateEntryLimit(owner, id, { maxEntries: 22 })).rejects.toMatchObject({
      response: { error: { code: 'ENTRY_LIMIT_BELOW_APPROVED_COUNT' } },
    });
    const removed = await prisma.tournamentRegistration.findFirstOrThrow({ where: { tournamentId: id }, orderBy: { sortOrder: 'desc' } });
    await entries.deleteEntry(owner, id, removed.id);
    await tournaments.updateEntryLimit(owner, id, { maxEntries: 22 });
    expect(await prisma.tournamentRegistration.count({ where: { tournamentId: id } })).toBe(22);
    expect((await tournaments.getTournament(owner, id)).data.tournament.canPrepareFixtures).toBe(true);
    await tournaments.prepareFixtures(owner, id);
    await wizard.generatePreview(owner, id);
    const fixtures = await prisma.fixture.findMany({ where: { tournamentId: id, phase: 'STAGE' } });
    expect(fixtures).toHaveLength(88);
    expect(fixtures.every(f => f.homeRegistrationId !== removed.id && f.awayRegistrationId !== removed.id)).toBe(true);
    const participants = new Set(fixtures.flatMap(f => [f.homeRegistrationId, f.awayRegistrationId]));
    expect(participants.size).toBe(22);
  }, 30000);

  it('generates a 20-team preview with four unused entry slots', async () => {
    const id = await createCup(20);
    await expect(tournaments.prepareFixtures(owner, id)).resolves.toMatchObject({
      data: { approvedEntries: 20, maxEntries: 24, nextStep: 'FIXTURE_SETTINGS' },
    });
    await wizard.generatePreview(owner, id);
    expect(await prisma.fixture.count({ where: { tournamentId: id, phase: 'STAGE' } })).toBe(80);
    const stored = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({ status: 'REGISTRATION_CLOSED', maxEntries: 24 });
  }, 30000);
});
