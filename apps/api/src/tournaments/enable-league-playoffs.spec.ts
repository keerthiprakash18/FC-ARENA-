import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayoffsService } from './playoffs.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { PrismaService } from '../database/prisma.service.js';

const tournament = {
  id: 'isl-20', name: 'ISL + I-League', status: 'ACTIVE',
  competitionFormat: 'LEAGUE_ROUND_ROBIN', groupMode: 'MULTIPLE_GROUPS',
  playoffSource: 'AUTO', playoffQualifiersTotal: null, playoffFormat: 'PROTECTED_SEED',
};
function createHarness(overrides: {
  status?: string; format?: string; groups?: number; playoffFixtures?: number;
  stageFixtures?: number; approvedEntries?: number;
} = {}) {
  const current = {
    ...tournament,
    status: overrides.status ?? tournament.status,
    competitionFormat: overrides.format ?? tournament.competitionFormat,
  };
  const tx = {
    tournament: {
      findUnique: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({ ...current, competitionFormat: 'GROUP_STAGE_KNOCKOUT' }),
    },
    tournamentGroup: { count: vi.fn().mockResolvedValue(overrides.groups ?? 0) },
    fixture: { count: vi.fn().mockImplementation(({ where }: { where: { phase: string } }) =>
      Promise.resolve(where.phase === 'PLAYOFF'
        ? overrides.playoffFixtures ?? 0 : overrides.stageFixtures ?? 190)) },
    tournamentRegistration: { count: vi.fn().mockResolvedValue(overrides.approvedEntries ?? 20) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
  };
  const prisma = {
    $transactionWithRetry: vi.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const service = new PlayoffsService(
    prisma as unknown as PrismaService,
    {} as AuthorizationService,
  );
  return { service, tx };
}

afterEach(() => vi.restoreAllMocks());

describe('existing 20-team single-table league to top-N playoffs conversion', () => {
  it('preserves 190 existing matches and creates no bracket before qualification', async () => {
    const permission = vi.spyOn(AuthorizationService.prototype, 'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const { service, tx } = createHarness();
    const response = await service.enableLeaguePlayoffs('owner', tournament.id, {
      playoffQualifiersTotal: 8,
      playoffFormat: 'PROTECTED_SEED',
      confirmation: tournament.name,
    });
    expect(response.data).toMatchObject({
      playoffQualifiersTotal: 8,
      stageFixturesPreserved: 190,
      existingResultsPreserved: true,
      bracketCreated: false,
    });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: tournament.id },
      data: expect.objectContaining({
        competitionFormat: 'GROUP_STAGE_KNOCKOUT',
        groupMode: 'SINGLE_GROUP',
        playoffSource: 'OVERALL_STANDINGS',
        playoffSeedingBasis: 'OVERALL_PERFORMANCE',
        playoffQualifiersTotal: 8,
        playoffFormat: 'PROTECTED_SEED',
      }),
    });
    expect(tx.fixture.count).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(permission).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ groups: 2 }, 8, 'LEAGUE_PLAYOFFS_GROUPS'],
    [{ playoffFixtures: 1 }, 8, 'LEAGUE_PLAYOFFS_EXISTS'],
    [{ approvedEntries: 4 }, 8, 'LEAGUE_PLAYOFFS_QUALIFIERS'],
    [{ stageFixtures: 0 }, 8, 'LEAGUE_PLAYOFFS_NO_STAGE'],
    [{ status: 'COMPLETED' }, 8, 'LEAGUE_PLAYOFFS_LOCKED'],
    [{ format: 'SINGLE_ELIMINATION' }, 8, 'LEAGUE_PLAYOFFS_FORMAT'],
  ] as const)('blocks dangerous or inapplicable changes before any write (%s)', async (input, qualifiers, code) => {
    vi.spyOn(AuthorizationService.prototype, 'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const { service, tx } = createHarness(input);
    await expect(service.enableLeaguePlayoffs('owner', tournament.id, {
      playoffQualifiersTotal: qualifiers, playoffFormat: 'PROTECTED_SEED', confirmation: tournament.name,
    })).rejects.toMatchObject({ response: { error: { code } } });
    expect(tx.tournament.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('requires the exact tournament name', async () => {
    vi.spyOn(AuthorizationService.prototype, 'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const { service, tx } = createHarness();
    await expect(service.enableLeaguePlayoffs('owner', tournament.id, {
      playoffQualifiersTotal: 8,
      playoffFormat: 'GLOBAL_SEEDED',
      confirmation: 'wrong tournament',
    })).rejects.toMatchObject({
      response: { error: { code: 'TOURNAMENT_CONFIRMATION_MISMATCH' } },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });
});
