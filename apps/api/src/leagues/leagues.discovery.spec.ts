import { describe, expect, it, vi } from 'vitest';
import { LeaguesService } from './leagues.service.js';

describe('LeaguesService discovery', () => {
  it('returns paginated public league summaries without invite codes or private member data', async () => {
    const prisma = {
      league: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'league-1',
            name: 'Chennai FC League',
            logoUrl: '/logo.png',
            description: 'Community league',
            region: 'Tamil Nadu',
            maxMembers: 100,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            creator: {
              id: 'owner-1',
              fullName: 'Owner Name',
              player: { profileImageUrl: '/owner.png', identity: { inGameName: 'owner' } },
            },
            members: [],
            applications: [],
            _count: { members: 24, tournaments: 3 },
          },
        ]),
      },
    };
    const service = new LeaguesService(prisma as never, {} as never, {} as never);

    const response = await service.discoverLeagues('viewer-1', { page: 1, pageSize: 10, sort: 'POPULAR' });

    expect(response.data.pagination).toMatchObject({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    expect(response.data.leagues[0]).toMatchObject({
      id: 'league-1',
      members: 24,
      tournamentCount: 3,
      creator: { username: 'owner' },
    });
    expect(response.data.leagues[0]).not.toHaveProperty('code');
    expect(response.data.leagues[0]).not.toHaveProperty('membersList');
  });
});
