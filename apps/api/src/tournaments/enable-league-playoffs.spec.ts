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
  groupMode?: string; source?: string; seeding?: string;
} = {}) {
  const current = {
    ...tournament,
    status: overrides.status ?? tournament.status,
    competitionFormat: overrides.format ?? tournament.competitionFormat,
    groupMode: overrides.groupMode ?? tournament.groupMode,
    playoffSource: overrides.source ?? tournament.playoffSource,
    playoffSeedingBasis: overrides.seeding ?? 'AUTO',
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
  it.each(['GLOBAL_SEEDED','PROTECTED_SEED','DOUBLE_CHANCE'] as const)('saves Top 12 with %s while preserving the league schedule', async playoffFormat => {
    vi.spyOn(AuthorizationService.prototype,'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const {service,tx}=createHarness({approvedEntries:14});
    const result=await service.enableLeaguePlayoffs('owner',tournament.id,{playoffQualifiersTotal:12,playoffFormat,confirmation:tournament.name});
    expect(result.data).toMatchObject({playoffQualifiersTotal:12,playoffFormat,stageFixturesPreserved:190,bracketCreated:false});
    expect(tx.tournament.update).toHaveBeenCalledWith({where:{id:tournament.id},data:expect.objectContaining({playoffQualifiersTotal:12,playoffFormat})});
  });
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
    [{ approvedEntries: 11 }, 12, 'LEAGUE_PLAYOFFS_QUALIFIERS'],
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

describe('admin reconfiguration of an already selected League + Playoffs format', () => {
  const configured = {
    format: 'GROUP_STAGE_KNOCKOUT',
    groupMode: 'SINGLE_GROUP',
    source: 'OVERALL_STANDINGS',
    seeding: 'OVERALL_PERFORMANCE',
  };

  it('changes only saved playoff rules, preserves 190 stage fixtures and writes an audit record', async () => {
    const permission = vi.spyOn(AuthorizationService.prototype, 'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const { service, tx } = createHarness(configured);
    const response = await service.reconfigureLeaguePlayoffs('owner', tournament.id, {
      playoffQualifiersTotal: 16,
      playoffFormat: 'DOUBLE_CHANCE',
      confirmation: tournament.name,
    });
    expect(response.data).toMatchObject({
      playoffQualifiersTotal: 16,
      playoffFormat: 'DOUBLE_CHANCE',
      stageFixturesPreserved: 190,
      existingResultsPreserved: true,
      bracketCreated: false,
    });
    expect(response.data.message).toContain('settings updated');
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: tournament.id },
      data: expect.objectContaining({
        competitionFormat: 'GROUP_STAGE_KNOCKOUT',
        playoffSource: 'OVERALL_STANDINGS',
        playoffQualifiersTotal: 16,
        playoffFormat: 'DOUBLE_CHANCE',
      }),
    });
    expect(tx.fixture.count).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PLAYOFF_FORMAT_UPDATED',
        afterData: expect.objectContaining({ reconfigure: true }) }),
    });
    expect(permission).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ playoffFixtures: 1 }, 'LEAGUE_PLAYOFFS_EXISTS'],
    [{ groups: 1 }, 'LEAGUE_PLAYOFFS_GROUPS'],
    [{ approvedEntries: 4 }, 'LEAGUE_PLAYOFFS_QUALIFIERS'],
    [{ stageFixtures: 0 }, 'LEAGUE_PLAYOFFS_NO_STAGE'],
    [{ status: 'COMPLETED' }, 'LEAGUE_PLAYOFFS_LOCKED'],
    [{ status: 'CANCELLED' }, 'LEAGUE_PLAYOFFS_LOCKED'],
    [{ format: 'SINGLE_ELIMINATION' }, 'LEAGUE_PLAYOFFS_FORMAT'],
    [{ source: 'GROUP_QUALIFIERS' }, 'LEAGUE_PLAYOFFS_FORMAT'],
    [{ seeding: 'RANDOM' }, 'LEAGUE_PLAYOFFS_FORMAT'],
  ] as const)('refuses unsafe changes with no writes (%s)', async (override, code) => {
    vi.spyOn(AuthorizationService.prototype, 'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const { service, tx } = createHarness({ ...configured, ...override });
    await expect(service.reconfigureLeaguePlayoffs('owner', tournament.id, {
      playoffQualifiersTotal: 8, playoffFormat: 'GLOBAL_SEEDED', confirmation: tournament.name,
    })).rejects.toMatchObject({ response: { error: { code } } });
    expect(tx.tournament.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('requires the exact tournament name and both organizer permissions', async () => {
    const permission = vi.spyOn(AuthorizationService.prototype, 'assertCanManageTournamentPermission').mockResolvedValue(undefined);
    const { service, tx } = createHarness(configured);
    await expect(service.reconfigureLeaguePlayoffs('owner', tournament.id, {
      playoffQualifiersTotal: 8, playoffFormat: 'PROTECTED_SEED', confirmation: 'wrong',
    })).rejects.toMatchObject({ response: { error: { code: 'TOURNAMENT_CONFIRMATION_MISMATCH' } } });
    expect(tx.tournament.update).not.toHaveBeenCalled();
    permission.mockRejectedValueOnce(new Error('forbidden'));
    await expect(service.reconfigureLeaguePlayoffs('viewer', tournament.id, {
      playoffQualifiersTotal: 8, playoffFormat: 'PROTECTED_SEED', confirmation: tournament.name,
    })).rejects.toThrow('forbidden');
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });
});
