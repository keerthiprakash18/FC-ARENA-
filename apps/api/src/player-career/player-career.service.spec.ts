import { describe, expect, it, vi } from 'vitest';
import { PlayerCareerService } from './player-career.service.js';
import type { PrismaService } from '../database/prisma.service.js';

function setup(identity: {
  inGameName: string;
  gameUid: string | null;
  isVerified: boolean;
  lockedAt: Date | null;
} | null = {
  inGameName: 'Old Name',
  gameUid: 'old-uid',
  isVerified: false,
  lockedAt: null,
}) {
  const current = {
    id: 'user-1',
    fullName: 'Old Full Name',
    email: 'player@example.com',
    phoneNumber: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    player: {
      id: 'player-1',
      playerCode: 'FCA-0001',
      profileImageUrl: null,
      identity,
    },
  };
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue(undefined),
    },
    playerIdentity: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  };
  return { service: new PlayerCareerService(prisma as unknown as PrismaService), tx };
}

describe('PlayerCareerService profile updates', () => {
  it('updates editable account and identity fields and never accepts email', async () => {
    const { service, tx } = setup();
    const result = await service.updateMyProfile('user-1', Object.assign({
      fullName: ' New Full Name ',
      phoneNumber: ' 555-0100 ',
      inGameName: ' New Name ',
      gameUid: ' new-uid ',
    }, { email: 'must-not-change@example.com' }));

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { fullName: 'New Full Name', phoneNumber: '555-0100' },
    });
    expect(tx.playerIdentity.updateMany).toHaveBeenCalledWith({
      where: { playerId: 'player-1', isVerified: false, lockedAt: null },
      data: {
        inGameName: 'New Name',
        inGameNameNormalized: 'new name',
        gameUid: 'new-uid',
      },
    });
    expect(result.data.profile.email).toBe('player@example.com');
    expect(tx.user.update.mock.calls[0][0].data.email).toBeUndefined();
  });

  it('rejects identity changes after verification or locking', async () => {
    const { service, tx } = setup({
      inGameName: 'Verified Name',
      gameUid: 'verified-uid',
      isVerified: true,
      lockedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    await expect(
      service.updateMyProfile('user-1', { inGameName: 'Attempted Change' }),
    ).rejects.toMatchObject({
      response: {
        error: { code: 'PLAYER_IDENTITY_LOCKED' },
      },
    });
    expect(tx.playerIdentity.updateMany).not.toHaveBeenCalled();
  });
});
