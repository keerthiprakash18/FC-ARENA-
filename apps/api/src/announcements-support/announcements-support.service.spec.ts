import { describe, expect, it, vi } from 'vitest';
import { AnnouncementsSupportService } from './announcements-support.service.js';

function prismaMock() {
  return {
    user: { findUnique: vi.fn() },
    leagueAdmin: { findFirst: vi.fn() },
    announcement: { findMany: vi.fn(), create: vi.fn() },
    supportTicket: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    supportTicketMessage: { create: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe('AnnouncementsSupportService', () => {
  it('does not allow regular users to publish announcements', async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.leagueAdmin.findFirst.mockResolvedValue(null);
    const service = new AnnouncementsSupportService(prisma as never);

    await expect(service.createAnnouncement('user-1', { title: 'Notice', body: 'A useful announcement.' })).rejects.toMatchObject({
      response: { error: { code: 'MANAGER_REQUIRED' } },
    });
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it('lets an organizer create a published announcement', async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.leagueAdmin.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.announcement.create.mockResolvedValue({ id: 'announcement-1', title: 'Notice', body: 'A useful announcement.' });
    const service = new AnnouncementsSupportService(prisma as never);

    const response = await service.createAnnouncement('organizer-1', { title: ' Notice ', body: ' A useful announcement. ' });

    expect(response.data.announcement.id).toBe('announcement-1');
    expect(prisma.announcement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { title: 'Notice', body: 'A useful announcement.', createdByUserId: 'organizer-1' },
    }));
  });

  it('returns only the caller tickets for a regular user', async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.leagueAdmin.findFirst.mockResolvedValue(null);
    prisma.supportTicket.findMany.mockResolvedValue([]);
    const service = new AnnouncementsSupportService(prisma as never);

    const response = await service.listTickets('user-1');

    expect(response.data.isManager).toBe(false);
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdByUserId: 'user-1' } }));
  });
});
