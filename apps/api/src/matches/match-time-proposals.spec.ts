import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchesService } from './matches.service.js';
import type { PrismaService } from '../database/prisma.service.js';

const originalFlag = process.env.MATCH_TIME_PROPOSALS_ENABLED;
beforeEach(() => { process.env.MATCH_TIME_PROPOSALS_ENABLED = 'true'; });
afterEach(() => {
  if (originalFlag === undefined) delete process.env.MATCH_TIME_PROPOSALS_ENABLED;
  else process.env.MATCH_TIME_PROPOSALS_ENABLED = originalFlag;
});

function setup(side: 'HOME' | 'AWAY' | null = 'HOME') {
  const transaction = {
    matchTimeProposal: {
      create: vi.fn().mockResolvedValue({ id: 'offer-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    matchTimeProposal: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({
        id: 'offer-1',
        matchId: 'match-1',
        proposedByUserId: 'home-user',
        proposedSide: 'HOME',
        status: 'PENDING',
      }),
    },
    $transaction: vi.fn(async (action: (tx: typeof transaction) => Promise<unknown>) => action(transaction)),
    fixture: { update: vi.fn() },
    match: { update: vi.fn() },
  };
  const service = new MatchesService(prisma as unknown as PrismaService, {} as never);
  const getMatchAccess = vi.fn().mockResolvedValue({
    match: {
      id: 'match-1', status: 'SCHEDULED',
      confirmedResultSubmissionId: null,
      tournament: { leagueId: 'league-1' },
      fixture: {
        scheduledAt: new Date('2026-11-12T12:00:00Z'),
        homeRegistration: { id: 'home' },
        awayRegistration: { id: 'away' },
      },
    },
    admin: null,
    isParticipant: side !== null,
    participantSide: side,
  });
  (service as unknown as { getMatchAccess: typeof getMatchAccess }).getMatchAccess = getMatchAccess;
  return { service, prisma, transaction, getMatchAccess };
}

describe('advisory time coordination', () => {
  it('is disabled by default and never exposes unauthorised proposals', async () => {
    const { service, prisma, getMatchAccess } = setup();
    delete process.env.MATCH_TIME_PROPOSALS_ENABLED;
    const result = await service.getTimeProposals('home-user', 'match-1');
    expect(result.data).toEqual({ enabled: false, proposals: [] });
    expect(getMatchAccess).toHaveBeenCalledOnce();
    expect(prisma.matchTimeProposal.findMany).not.toHaveBeenCalled();
    await expect(service.proposeMatchTime('home-user', 'match-1', {
      startsAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    })).rejects.toThrow('not enabled');
  });

  it('proposes within 14 days with an audit entry but does not update official schedule', async () => {
    const { service, prisma, transaction } = setup();
    const date = new Date(Date.now() + 2 * 3600_000).toISOString();
    const result = await service.proposeMatchTime('home-user', 'match-1', {
      startsAt: date, note: 'After work',
    });
    expect(result.data.officialScheduleUnchanged).toBe(true);
    expect(transaction.matchTimeProposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: 'match-1', proposedByUserId: 'home-user', proposedSide: 'HOME',
        startsAt: new Date(date),
      }),
    });
    expect(transaction.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.fixture.update).not.toHaveBeenCalled();
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('requires other side to accept, with idempotent pending-only update', async () => {
    const self = setup('HOME');
    await expect(self.service.acceptMatchTime('home-user', 'match-1', 'offer-1'))
      .rejects.toThrow('own time proposal');
    expect(self.transaction.matchTimeProposal.updateMany).not.toHaveBeenCalled();

    const other = setup('AWAY');
    const result = await other.service.acceptMatchTime('away-user', 'match-1', 'offer-1');
    expect(result.data.accepted).toBe(true);
    expect(result.data.officialScheduleUnchanged).toBe(true);
    expect(other.transaction.matchTimeProposal.updateMany).toHaveBeenCalledWith({
      where: { id: 'offer-1', matchId: 'match-1', status: 'PENDING', proposedSide: { not: 'AWAY' } },
      data: expect.objectContaining({ status: 'ACCEPTED', confirmedByUserId: 'away-user' }),
    });
    expect(other.prisma.fixture.update).not.toHaveBeenCalled();
  });

  it('rejects unbound admins, late offers and completed match coordination', async () => {
    const { service, getMatchAccess } = setup(null);
    await expect(service.proposeMatchTime('admin', 'match-1', {
      startsAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    })).rejects.toThrow('Only match participants');
    const another = setup();
    await expect(another.service.proposeMatchTime('home-user', 'match-1', {
      startsAt: new Date(Date.now() + 20 * 24 * 3600_000).toISOString(),
    })).rejects.toThrow('14 days');
    const completed = setup();
    const access = await getMatchAccess();
    (completed.getMatchAccess as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ...access, match: { ...access.match, status: 'COMPLETED' },
    });
    await expect(completed.service.proposeMatchTime('home-user', 'match-1', {
      startsAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    })).rejects.toThrow('locked');
  });

  it('cancels only the proposing participant while retaining audit', async () => {
    const { service, transaction, prisma } = setup();
    await service.cancelMatchTime('home-user', 'match-1', 'offer-1');
    expect(transaction.matchTimeProposal.updateMany).toHaveBeenCalledWith({
      where: { id: 'offer-1', matchId: 'match-1', proposedByUserId: 'home-user', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.fixture.update).not.toHaveBeenCalled();
  });
});
