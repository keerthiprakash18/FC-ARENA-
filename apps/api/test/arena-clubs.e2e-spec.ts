import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { ClubsService } from '../src/clubs/clubs.service.js';

/**
 * Real PostgreSQL integration proof for persistent clubs.
 * Always fails closed if accidentally pointed at production or a remote host.
 */
describe('Arena Clubs: real database invitations, captain rights, opt-in linkage', () => {
  let prisma: PrismaService;
  let clubs: ClubsService;
  let captainId: string;
  let teammateId: string;
  let outsiderId: string;
  let clubId: string;
  let clubSlug: string;
  let firstInvite: string;
  let registrationId: string;
  const suffix = randomUUID().replace(/-/g,'').slice(0,10);

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' ||
      !['localhost','127.0.0.1','[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')) {
      throw new Error('Arena Clubs E2E requires disposable loopback *_test PostgreSQL; NEVER production.');
    }
    prisma = new PrismaService();
    await prisma.$connect();
    clubs = new ClubsService(prisma);
    const users = await Promise.all(['captain','teammate','outsider'].map(role =>
      prisma.user.create({ data: {
        email: `club-${role}-${suffix}@example.invalid`,
        fullName: `Club E2E ${role}`,
        passwordHash: 'not-a-real-login-hash', status:'ACTIVE',
      } })));
    [captainId,teammateId,outsiderId] = users.map(u=>u.id);
    const league=await prisma.league.create({ data: {
      name:`Club E2E ${suffix}`,code:`C${suffix}`,creatorUserId:captainId,
    } });
    const tournament=await prisma.tournament.create({ data:{
      leagueId:league.id,createdByUserId:captainId,
      name:`Club E2E Tournament ${suffix}`,code:`TC${suffix}`,
      mode:'DUO',format:'ROUND_ROBIN',teamSize:2,maxEntries:8,
      status:'REGISTRATION_CLOSED',
    } });
    const registration=await prisma.tournamentRegistration.create({ data: {
      tournamentId:tournament.id,registeredByUserId:captainId,
      status:'APPROVED',entryName:`E2E United ${suffix}`,
      members:{ create:[
        {tournamentId:tournament.id,userId:captainId},
        {tournamentId:tournament.id,userId:teammateId},
      ] },
    } });
    registrationId=registration.id;
  }, 30000);

  afterAll(async () => { await prisma?.$disconnect(); });

  it('creates captain-owned club and exposes the invitation once without exposing invite hash', async () => {
    const response=await clubs.create(captainId,{
      name:`E2E Phantoms ${suffix}`,description:'Verified club',
    });
    clubId=response.data.club.id;
    clubSlug=response.data.club.slug;
    firstInvite=response.data.inviteCode;
    expect(firstInvite).toMatch(/^[a-f0-9]{24}$/);
    const db=await prisma.arenaClub.findUniqueOrThrow({where:{id:clubId}});
    expect(db.inviteHash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.inviteHash).not.toBe(firstInvite);
    const directory=await clubs.list(captainId);
    expect(directory.data.clubs.find(c=>c.id===clubId)?.myClub).toBe(true);
    expect(JSON.stringify(directory)).not.toContain('inviteHash');
    expect(JSON.stringify(directory)).not.toContain(firstInvite);
  });

  it('requires invite and verified roster before captain links one active DUO entry', async () => {
    const before=await clubs.linkableEntries(captainId,clubId);
    expect(before.data.entries).toEqual([]);
    await expect(clubs.linkEntry(captainId,clubId,registrationId))
      .rejects.toThrow(/All registered teammates must join/);
    const joined=await clubs.join(teammateId,firstInvite);
    expect(joined.data.club.id).toBe(clubId);
    await expect(clubs.join(teammateId,firstInvite)).rejects.toThrow(/already a club member/);
    const available=await clubs.linkableEntries(captainId,clubId);
    expect(available.data.entries.some(e=>e.id===registrationId)).toBe(true);
    await expect(clubs.linkEntry(outsiderId,clubId,registrationId)).rejects.toThrow(/club captain/);
    await clubs.linkEntry(captainId,clubId,registrationId);
    await expect(clubs.linkEntry(captainId,clubId,registrationId)).rejects.toThrow(/already linked/);
    const result=await clubs.details(captainId,clubSlug);
    expect(result.data.club.members).toHaveLength(2);
    expect(result.data.club.entries).toHaveLength(1);
    expect(result.data.stats).toMatchObject({
      matches:0,wins:0,losses:0,goalsFor:0,goalsAgainst:0,
    });
  });

  it('lets only the captain rotate an invite and rejects the old invitation', async () => {
    await expect(clubs.rotateInvite(teammateId,clubId)).rejects.toThrow(/Only the club captain/);
    const rotated=await clubs.rotateInvite(captainId,clubId);
    expect(rotated.data.inviteCode).toMatch(/^[a-f0-9]{24}$/);
    expect(rotated.data.inviteCode).not.toBe(firstInvite);
    await expect(clubs.join(outsiderId,firstInvite)).rejects.toThrow(/invalid or has expired/);
    const joined=await clubs.join(outsiderId,rotated.data.inviteCode);
    expect(joined.data.club.id).toBe(clubId);
  });
});
