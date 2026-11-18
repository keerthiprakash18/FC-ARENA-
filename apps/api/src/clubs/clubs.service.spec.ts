import { describe, expect, it, vi } from 'vitest';
import { ClubsService } from './clubs.service.js';

function serviceFor(prisma: Record<string, unknown>) {
  return new ClubsService(prisma as never);
}
describe('Persistent club authorization and verified team history', () => {
  it('does not include private player contact details in a club listing', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({id:'u',status:'ACTIVE'}) },
      arenaClub: { findMany: vi.fn().mockResolvedValue([{id:'c',name:'Example',slug:'example',ownerUserId:'u',_count:{members:2,entries:0}}]) },
    };
    const result = await serviceFor(prisma).list('u');
    expect(result.data.clubs[0].myClub).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/email|phone|whatsapp|inviteHash/);
  });

  it('refuses roster linkage when teammate membership cannot be proven', async () => {
    const tx = {
      arenaClub: { findUnique: vi.fn().mockResolvedValue({id:'c',ownerUserId:'u'}) },
      tournamentRegistration: { findUnique: vi.fn().mockResolvedValue({
        id:'r',status:'APPROVED', tournament:{mode:'DUO',status:'ACTIVE'},
        members:[{userId:'u'},{userId:'other'}],arenaClubEntry:null,
      }) },
      arenaClubMember: { count: vi.fn().mockResolvedValue(1) },
      fixture: { count: vi.fn() }, arenaClubEntry: { create: vi.fn() }, auditLog: { create: vi.fn() },
    };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({id:'u',status:'ACTIVE'}) },
      $transactionWithRetry: vi.fn(async (fn: (tx: typeof tx)=>unknown) => fn(tx)) };
    await expect(serviceFor(prisma).linkEntry('u','c','r')).rejects.toThrow(/All registered teammates/);
    expect(tx.arenaClubEntry.create).not.toHaveBeenCalled();
  });

  it('rejects claiming an entry after the first verified result', async () => {
    const tx = {
      arenaClub: { findUnique: vi.fn().mockResolvedValue({id:'c',ownerUserId:'u'}) },
      tournamentRegistration: { findUnique: vi.fn().mockResolvedValue({
        id:'r',status:'APPROVED', tournament:{mode:'TEAM',status:'ACTIVE'},
        members:[{userId:'u'}],arenaClubEntry:null,
      }) },
      arenaClubMember: { count: vi.fn().mockResolvedValue(1) },
      fixture: { count: vi.fn().mockResolvedValue(1) },
      arenaClubEntry: { create: vi.fn() }, auditLog: { create: vi.fn() },
    };
    const prisma={user:{findUnique:vi.fn().mockResolvedValue({id:'u',status:'ACTIVE'})},
      $transactionWithRetry: vi.fn(async (fn: (tx: typeof tx)=>unknown)=>fn(tx))};
    await expect(serviceFor(prisma).linkEntry('u','c','r')).rejects.toThrow(/verified match results/);
    expect(tx.arenaClubEntry.create).not.toHaveBeenCalled();
  });

  it('only counts confirmed outcomes from explicitly bound registrations', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({id:'u',status:'ACTIVE'}) },
      arenaClub: { findUnique: vi.fn().mockResolvedValue({
        id:'c',slug:'example',name:'Example',ownerUserId:'u',members:[{userId:'u'}],
        entries:[{registrationId:'r'}],
      }) },
      fixture: { findMany: vi.fn().mockResolvedValue([
        { homeRegistrationId:'r',awayRegistrationId:'op',match:{confirmedResult:{status:'CONFIRMED',homeScore:3,awayScore:1,homePenaltyScore:null,awayPenaltyScore:null}} },
        { homeRegistrationId:'op',awayRegistrationId:'r',match:{confirmedResult:{status:'PENDING_VERIFICATION',homeScore:4,awayScore:0}} },
      ]) },
    };
    const result=await serviceFor(prisma).details('u','example');
    expect(result.data.stats).toMatchObject({matches:1,wins:1,goalsFor:3,goalsAgainst:1,winRate:100});
  });
});
