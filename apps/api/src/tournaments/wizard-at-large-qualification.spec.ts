import { describe, expect, it, vi } from 'vitest';
import { TournamentWizardFinalizeService } from './tournament-wizard-finalize.service.js';

function setup(sizes = [6, 6, 6, 6, 6, 6, 6]) {
  const tournament = {
    id: 'tour-1', status: 'DRAFT', competitionFormat: 'GROUP_STAGE_KNOCKOUT',
    groupMode: 'MULTIPLE_GROUPS', qualifiersPerGroup: 2,
    playoffQualifiersTotal: null,
  };
  const groups = sizes.map((size, i) => ({
    id: `group-${i + 1}`, name: `Group ${i + 1}`, position: i + 1,
    _count: { registrations: size },
  }));
  const prisma = {
    fixture: { count: vi.fn().mockResolvedValue(0) },
    tournamentGroup: { findMany: vi.fn().mockResolvedValue(groups) },
    tournamentRegistration: {
      count: vi.fn().mockResolvedValue(sizes.reduce((a, b) => a + b, 0)),
    },
    tournament: { update: vi.fn().mockResolvedValue({ ...tournament }) },
  };
  const service = new TournamentWizardFinalizeService(prisma as never, {} as never);
  (service as unknown as { getAdminTournament: () => Promise<unknown> })
    .getAdminTournament = vi.fn().mockResolvedValue(tournament);
  const dto = {
    qualifiersPerGroup: 2,
    playoffQualifiersTotal: 16,
    playoffFormat: 'PROTECTED_SEED' as const,
    playoffSource: 'GROUP_QUALIFIERS' as const,
    playoffSeedingBasis: 'AUTO' as const,
  };
  return { service, prisma, dto };
}

describe('wizard persists balanced group + best next-place qualification', () => {
  it('saves 16 teams from seven groups of six: top 14 plus best two third-place', async () => {
    const { service, prisma, dto } = setup();
    const result = await service.saveQualification('admin-1', 'tour-1', dto);
    expect(result.data.totalQualifiers).toBe(16);
    expect(result.data.resolvedSource).toBe('GROUP_QUALIFIERS');
    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tour-1' },
      data: expect.objectContaining({
        qualifiersPerGroup: 2, playoffQualifiersTotal: 16,
        playoffSource: 'GROUP_QUALIFIERS',
        wizardStep: 'FIXTURE_SETTINGS',
      }),
    });
  });

  it('rejects totals lower than direct 14 and greater than best next-place seven', async () => {
    const low = setup();
    await expect(low.service.saveQualification('admin-1', 'tour-1', {
      ...low.dto, playoffQualifiersTotal: 13,
    })).rejects.toThrow('Use between 14');
    expect(low.prisma.tournament.update).not.toHaveBeenCalled();
    const high = setup();
    await expect(high.service.saveQualification('admin-1', 'tour-1', {
      ...high.dto, playoffQualifiersTotal: 22,
    })).rejects.toThrow('Use between 14');
    expect(high.prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('refuses best-next-place selection between groups of different sizes', async () => {
    const setupResult = setup([6, 6, 6, 6, 6, 6, 5]);
    await expect(setupResult.service.saveQualification('admin-1', 'tour-1', setupResult.dto))
      .rejects.toThrow('equally sized groups');
    expect(setupResult.prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('prevents extra cross-group places when bracket cannot avoid early same-group ties', async () => {
    const candidate = setup();
    await expect(candidate.service.saveQualification('admin-1', 'tour-1', {
      ...candidate.dto, playoffFormat: 'GLOBAL_SEEDED',
    })).rejects.toThrow('Protected Seed playoffs');
    expect(candidate.prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('keeps backward compatible direct-only group settings', async () => {
    const { service, prisma, dto } = setup();
    const result = await service.saveQualification('admin-1', 'tour-1', {
      ...dto, playoffQualifiersTotal: 14,
    });
    expect(result.data.totalQualifiers).toBe(14);
    expect(prisma.tournament.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ playoffQualifiersTotal: 14 }),
    }));
  });
});
