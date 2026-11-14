import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { SecurityModule } from '../src/security/security.module.js';
import { ExperienceModule } from '../src/experience/experience.module.js';
import { ArenaModule } from '../src/arena/arena.module.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ExperienceService } from '../src/experience/experience.service.js';
import { ArenaService } from '../src/arena/arena.service.js';
import { ArenaMediaService } from '../src/arena/arena-media.service.js';
import { AuditService } from '../src/security/audit.service.js';
import { SafetyService } from '../src/security/safety.service.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { LeaguesService } from '../src/leagues/leagues.service.js';
import { AdminOpsService } from '../src/admin-ops/admin-ops.service.js';

describe('Player progress and Arena Talk with real PostgreSQL', () => {
  let db: PrismaService,
    arena: ArenaService,
    media: ArenaMediaService,
    experience: ExperienceService;
  let owner: string,
    member: string,
    outsider: string,
    admin: string,
    leagueId: string,
    tournamentId: string;
  const run = randomUUID().slice(0, 8);
  let sequence = 0;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error(
        'Requires an explicitly selected disposable loopback *_test database.',
      );
    process.env.JWT_ACCESS_SECRET = `community-test-only-${run}`;
    process.env.JWT_REFRESH_SECRET = `community-refresh-test-only-${run}`;
    process.env.ARENA_MEDIA_DIR = resolve(
      process.cwd(),
      '../../.cache/community/test-media',
    );
    db = new PrismaService();
    await db.$connect();
    media = new ArenaMediaService(db);
    arena = new ArenaService(db, media);
    experience = new ExperienceService(
      db,
      new SafetyService(db, new AuditService(db)),
    );
    async function user(label: string, superAdmin = false) {
      return (
        await db.user.create({
          data: {
            fullName: label,
            email: `${label}-${run}@example.invalid`,
            passwordHash: 'not-a-login-hash',
            status: 'ACTIVE',
            role: superAdmin ? 'SUPER_ADMIN' : 'USER',
            player: {
              create: {
                playerCode: `${label}${run}`,
                identity: {
                  create: {
                    inGameName: `${label}${run}`,
                    inGameNameNormalized: `${label}${run}`.toLowerCase(),
                    isVerified: true,
                  },
                },
              },
            },
          },
        })
      ).id;
    }
    owner = await user('Owner');
    member = await user('Member');
    outsider = await user('Outsider');
    admin = await user('Admin', true);
    leagueId = (
      await db.league.create({
        data: {
          code: `SOC${run}`,
          name: `Community ${run}`,
          creatorUserId: owner,
        },
      })
    ).id;
    await db.leagueAdmin.create({ data: { leagueId, userId: owner, role: 'OWNER' } });
    await db.leagueMember.createMany({
      data: [owner, member].map((userId) => ({
        userId,
        leagueId,
        type: 'PRIMARY',
      })),
    });
    await db.arenaLeagueSubscription.createMany({
      data: [owner, member].map(userId => ({ userId, leagueId })),
    });
    tournamentId = (
      await db.tournament.create({
        data: {
          leagueId,
          createdByUserId: owner,
          code: `XP${run}`,
          name: 'Verified XP cup',
          mode: 'SOLO',
          format: 'ROUND_ROBIN',
          teamSize: 1,
          maxEntries: 4,
          status: 'ACTIVE',
        },
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  const viewer = () => ({ sub: member });
  it('attributes approved invite applications, rejects expired tokens and restricts aggregate analytics', async () => {
    const authorization = new AuthorizationService(db);
    const leagues = new LeaguesService(db, new SafetyService(db, new AuditService(db)), authorization);
    const adminOps = new AdminOpsService(db);
    const candidate = await db.user.create({
      data: { fullName: 'Invite Player', email: `invite-${run}@example.invalid`, passwordHash: 'synthetic-test-record' },
    });
    try {
      await expect(leagues.createInvite(member, leagueId)).rejects.toMatchObject({ status: 403 });
      await expect(adminOps.playerActivity(member)).rejects.toMatchObject({ status: 403 });
      const before = (await adminOps.playerActivity(admin)).data;
      const sessionNow = new Date();
      await db.refreshSession.create({
        data: { id: randomUUID(), userId: candidate.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600_000) },
      });
      expect((await adminOps.playerActivity(admin, new Date(sessionNow.getTime() + 60_000))).data.weekly).toBe(before.weekly + 1);
      const { data: invite } = await leagues.createInvite(owner, leagueId);
      const preview = (await leagues.previewByCode(candidate.id, '', invite.token)).data.league;
      expect(preview).toMatchObject({ id: leagueId, code: null, alreadyMember: false });
      const applied = await leagues.requestToJoin(candidate.id, '', invite.token);
      await leagues.approveApplication(owner, leagueId, applied.data.application.id);
      const after = (await adminOps.playerActivity(admin)).data;
      expect(after.inviteApplications).toBe(before.inviteApplications + 1);
      expect(after.inviteApprovals).toBe(before.inviteApprovals + 1);
      await db.leagueInvite.update({ where: { id: applied.data.application.inviteId! }, data: { expiresAt: new Date(0) } });
      await expect(leagues.previewByCode(outsider, '', invite.token)).rejects.toMatchObject({ status: 404 });
      await expect(leagues.requestToJoin(outsider, '', invite.token)).rejects.toMatchObject({ status: 404 });
    } finally {
      await db.user.delete({ where: { id: candidate.id } });
    }
  });
  it('requires an explicit room opt-in and applies one-way mutes without changing access', async () => {
    await arena.setSubscription(member, leagueId, false);
    await expect(arena.feed(viewer(), 'LEAGUE', leagueId)).rejects.toMatchObject({ status: 403 });
    await expect(arena.setSubscription(outsider, leagueId, true)).rejects.toMatchObject({ status: 404 });
    await arena.setSubscription(member, leagueId, true);
    const published = await post();
    expect((await arena.feed(viewer(), 'LEAGUE', leagueId)).data.posts.some(item => item.id === published.id)).toBe(true);
    await arena.setMute(member, owner, true);
    expect((await arena.context(member)).data.mutedPlayers.map(player => player.id)).toContain(owner);
    expect((await arena.context(owner)).data.mutedPlayers.map(player => player.id)).not.toContain(member);
    expect((await arena.feed(viewer(), 'LEAGUE', leagueId)).data.posts.some(item => item.author?.id === owner)).toBe(false);
    await arena.setMute(member, owner, false);
    expect((await arena.context(member)).data.mutedPlayers).toEqual([]);
    expect((await arena.feed(viewer(), 'LEAGUE', leagueId)).data.posts.some(item => item.id === published.id)).toBe(true);
  });
  async function post(author = owner, league = true, extra = {}) {
    return (
      await arena.create(
        { sub: author },
        {
          clientRequestId: randomUUID(),
          audience: league ? 'LEAGUE' : 'PUBLIC',
          ...(league ? { leagueId } : {}),
          kind: 'DISCUSSION',
          body: 'A proper football conversation.',
          ...extra,
        },
      )
    ).data.post;
  }
  async function verifiedMatch(at: string) {
    sequence++;
    const fixture = await db.fixture.create({
      data: {
        tournamentId,
        fixtureCode: `XP-${run}-${sequence}`,
        sequence,
        roundNumber: 1,
        roundName: 'Round 1',
        bracketPosition: sequence,
        status: 'COMPLETED',
      },
    });
    const match = await db.match.create({
      data: { tournamentId, fixtureId: fixture.id, status: 'COMPLETED' },
    });
    const result = await db.resultSubmission.create({
      data: {
        matchId: match.id,
        submittedByUserId: owner,
        homeScore: 2,
        awayScore: 1,
        status: 'CONFIRMED',
      },
    });
    await db.match.update({
      where: { id: match.id },
      data: { confirmedResultSubmissionId: result.id },
    });
    await db.matchResultStatEvent.create({
      data: {
        tournamentId,
        matchId: match.id,
        resultSubmissionId: result.id,
        type: 'APPLY',
        createdAt: new Date(at),
        payload: {
          home: { userIds: [owner], score: 2 },
          away: { userIds: [member], score: 1 },
        },
      },
    });
    return { match, result, fixture };
  }
  it('derives XP only from canonical completed matches and reconciles corrections and reversals', async () => {
    const { match, result } = await verifiedMatch('2026-10-25T18:30:00Z');
    const before = (await experience.getMine(owner)).data;
    expect(before).toMatchObject({ verifiedMatches: 1, totalXp: 30 });
    expect(before.recentWeeks[0].week).toBe('2026-10-26');
    const correction = await db.resultSubmission.create({
      data: {
        matchId: match.id,
        submittedByUserId: owner,
        homeScore: 3,
        awayScore: 1,
        status: 'CONFIRMED',
      },
    });
    await db.matchResultStatEvent.create({
      data: {
        tournamentId,
        matchId: match.id,
        resultSubmissionId: correction.id,
        type: 'APPLY',
        createdAt: new Date('2026-11-03T12:00:00Z'),
        payload: { home: { userIds: [owner] }, away: { userIds: [member] } },
      },
    });
    await db.match.update({
      where: { id: match.id },
      data: { confirmedResultSubmissionId: correction.id },
    });
    expect((await experience.getMine(owner)).data).toMatchObject({
      totalXp: 30,
      verifiedMatches: 1,
      recentWeeks: [{ week: '2026-10-26' }],
    });
    await db.match.update({
      where: { id: match.id },
      data: { status: 'LIVE', confirmedResultSubmissionId: null },
    });
    expect((await experience.getMine(owner)).data.totalXp).toBe(0);
    await db.match.update({
      where: { id: match.id },
      data: { status: 'COMPLETED', confirmedResultSubmissionId: result.id },
    });
  });
  it('never accepts a locked frame and keeps personal mission history out of public summaries', async () => {
    await expect(
      experience.selectFrame(outsider, 'CHAMPION'),
    ).rejects.toMatchObject({ status: 403 });
    const summary = (await experience.publicSummary(member, owner)).data;
    expect(summary).not.toHaveProperty('week');
    expect(summary).not.toHaveProperty('recentWeeks');
  });
  it('enforces current league membership for feed, post, comments, reactions and votes', async () => {
    const p = await post();
    expect(
      (await arena.feed(viewer(), 'LEAGUE', leagueId)).data.posts.some(
        (item) => item.id === p.id,
      ),
    ).toBe(true);
    expect(
      (await arena.feed({ sub: outsider }, 'PUBLIC')).data.posts.some(
        (item) => item.id === p.id,
      ),
    ).toBe(false);
    await expect(
      arena.feed({ sub: outsider }, 'LEAGUE', leagueId),
    ).rejects.toMatchObject({ status: 404 });
    for (const attempt of [
      () => arena.post({ sub: outsider }, p.id),
      () => arena.react({ sub: outsider }, p.id, true),
      () => arena.comments({ sub: outsider }, p.id),
      () => arena.vote({ sub: outsider }, p.id, randomUUID()),
    ])
      await expect(attempt()).rejects.toMatchObject({ status: 404 });
  });
  it('creates a post exactly once across concurrent retries and rejects changed content for the same request', async () => {
    const clientRequestId = randomUUID();
    const dto = {
      clientRequestId,
      audience: 'PUBLIC' as const,
      kind: 'DISCUSSION' as const,
      body: 'Retry-safe football debate.',
    };
    const replies = await Promise.all([
      arena.create({ sub: outsider }, dto),
      arena.create({ sub: outsider }, dto),
    ]);
    expect(replies[0].data.post.id).toBe(replies[1].data.post.id);
    expect(await db.arenaPost.count({ where: { clientRequestId } })).toBe(1);
    await expect(
      arena.create({ sub: outsider }, { ...dto, body: 'Changed body' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('maintains one vote and reaction per player, validates options and closes polls', async () => {
    const p = await post(member, false, {
      pollOptions: ['Home win', 'Away win'],
    });
    const options = p.poll!.options;
    await Promise.all([
      arena.vote({ sub: outsider }, p.id, options[0].id),
      arena.vote({ sub: outsider }, p.id, options[1].id),
    ]);
    expect(
      await db.arenaPollVote.count({
        where: { postId: p.id, userId: outsider },
      }),
    ).toBe(1);
    await expect(
      arena.vote({ sub: outsider }, p.id, randomUUID()),
    ).rejects.toMatchObject({ status: 400 });
    await Promise.all([
      arena.react({ sub: outsider }, p.id, true),
      arena.react({ sub: outsider }, p.id, true),
    ]);
    expect(await db.arenaReaction.count({ where: { postId: p.id } })).toBe(1);
    await arena.react({ sub: outsider }, p.id, false);
    expect(await db.arenaReaction.count({ where: { postId: p.id } })).toBe(0);
    await db.arenaPost.update({
      where: { id: p.id },
      data: {
        createdAt: new Date(Date.now() - 5000),
        pollEndsAt: new Date(Date.now() - 1000),
      },
    });
    await expect(
      arena.vote({ sub: outsider }, p.id, options[0].id),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('keeps official result cards unique, updates corrected scores and hides reversed results', async () => {
    const { match } = await verifiedMatch('2026-10-26T12:00:00Z');
    await arena.feed(viewer(), 'LEAGUE', leagueId);
    await arena.feed(viewer(), 'LEAGUE', leagueId);
    const system = await db.arenaPost.findUniqueOrThrow({
      where: { sourceMatchId: match.id },
    });
    expect(
      await db.arenaPost.count({ where: { sourceMatchId: match.id } }),
    ).toBe(1);
    await expect(
      arena.hidePost({ sub: owner }, system.id),
    ).rejects.toMatchObject({ status: 403 });
    await db.resultSubmission.update({
      where: {
        id:
          match.confirmedResultSubmissionId ??
          (await db.match.findUniqueOrThrow({ where: { id: match.id } }))
            .confirmedResultSubmissionId!,
      },
      data: { homeScore: 4 },
    });
    expect(
      (await arena.post(viewer(), system.id)).data.post.result?.homeScore,
    ).toBe(4);
    await db.match.update({
      where: { id: match.id },
      data: { confirmedResultSubmissionId: null, status: 'LIVE' },
    });
    await expect(arena.post(viewer(), system.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('authorizes signed image reads against current membership and rejects malformed files', async () => {
    const bytes = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    const p = (
      await arena.create(
        { sub: member },
        {
          clientRequestId: randomUUID(),
          audience: 'LEAGUE',
          leagueId,
          kind: 'DISCUSSION',
          body: 'Matchday photo',
        },
        {
          buffer: bytes,
          size: bytes.length,
          mimetype: 'image/png',
        } as Express.Multer.File,
      )
    ).data.post;
    const grant = new URL(
      p.imageUrl!,
      'https://example.invalid',
    ).searchParams.get('grant')!;
    expect((await arena.image(p.id, grant)).length).toBeGreaterThan(0);
    await expect(arena.image(p.id, grant + 'x')).rejects.toMatchObject({
      status: 403,
    });
    await db.leagueMember.delete({
      where: { leagueId_userId: { leagueId, userId: member } },
    });
    await expect(arena.image(p.id, grant)).rejects.toMatchObject({
      status: 404,
    });
    await db.leagueMember.create({
      data: { leagueId, userId: member, type: 'PRIMARY' },
    });
    await expect(
      media.prepare({
        buffer: Buffer.from('<svg/>'),
        size: 6,
        mimetype: 'image/png',
      } as Express.Multer.File),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('deduplicates comments, restricts edits, and reviews reports with audited moderator decisions', async () => {
    const p = await post(outsider, false);
    const dto = { clientRequestId: randomUUID(), body: 'Great match.' };
    await Promise.all([
      arena.comment(viewer(), p.id, dto),
      arena.comment(viewer(), p.id, dto),
    ]);
    const c = (await arena.comments(viewer(), p.id)).data.comments[0];
    expect(await db.arenaComment.count({ where: { postId: p.id } })).toBe(1);
    await expect(
      arena.editComment({ sub: owner }, p.id, c.id, 'Forged edit'),
    ).rejects.toMatchObject({ status: 404 });
    const report = (
      await arena.report({ sub: owner }, p.id, { reason: 'SPAM_OR_SCAM' }, c.id)
    ).data.report;
    await expect(arena.reports(owner)).rejects.toMatchObject({ status: 403 });
    expect(
      (await arena.reports(admin)).data.reports.some((r) => r.id === report.id),
    ).toBe(true);
    await arena.resolveReport(admin, report.id, {
      action: 'HIDE',
      note: 'Removed for a policy violation.',
    });
    expect((await arena.comments(viewer(), p.id)).data.comments).toHaveLength(
      0,
    );
    expect(
      await db.auditLog.count({
        where: { action: 'ARENA_REPORT_REVIEWED', targetId: report.id },
      }),
    ).toBe(1);
  });
  it('protects HTTP endpoints with authentication, strict DTOs and server-side permissions', async () => {
    process.env.ARENA_MEDIA_CLEANUP_ENABLED = 'false';
    const app = (
      await Test.createTestingModule({
        imports: [PrismaModule, SecurityModule, ExperienceModule, ArenaModule],
      }).compile()
    ).createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    const token = new JwtService().sign(
      {
        sub: admin,
        email: 'http@example.invalid',
        role: 'SUPER_ADMIN',
        type: 'access',
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 60 },
    );
    const server = app.getHttpServer();
    const auth = { Authorization: `Bearer ${token}` };
    try {
      await request(server).get('/api/experience/me').expect(401);
      await request(server).get('/api/experience/me').set(auth).expect(200);
      const locked = await request(server)
        .patch('/api/experience/me/frame')
        .set(auth)
        .send({ frame: 'CHAMPION' })
        .expect(403);
      expect(locked.body.error.message).toContain('Level 10');
      await request(server)
        .patch('/api/experience/me/frame')
        .set(auth)
        .send({ frame: 'CLASSIC', totalXp: 99999 })
        .expect(400);
      await request(server)
        .post('/api/arena-talk/posts')
        .set(auth)
        .send({
          clientRequestId: randomUUID(),
          audience: 'PUBLIC',
          kind: 'RESULT',
          body: 'Fake result',
        })
        .expect(400);
      await request(server)
        .post('/api/arena-talk/posts')
        .set(auth)
        .send({
          clientRequestId: randomUUID(),
          audience: 'PUBLIC',
          kind: 'DISCUSSION',
          body: '   ',
        })
        .expect(400);
      const response = await request(server)
        .post('/api/arena-talk/posts')
        .set(auth)
        .field('clientRequestId', randomUUID())
        .field('audience', 'PUBLIC')
        .field('kind', 'QUESTION')
        .field('body', 'HTTP poll')
        .field('pollOptions', JSON.stringify(['Yes', 'No']))
        .field('pollDurationHours', '24')
        .expect(201);
      expect(response.body.data.post.poll.options).toHaveLength(2);
      await request(server)
        .put(`/api/arena-talk/posts/${response.body.data.post.id}/reaction`)
        .set(auth)
        .send({ liked: 'true' })
        .expect(400);
      await request(server)
        .put(`/api/arena-talk/posts/${response.body.data.post.id}/reaction`)
        .set(auth)
        .send({ liked: true })
        .expect(200);
      await request(server)
        .get('/api/arena-talk/posts/not-a-uuid')
        .set(auth)
        .expect(400);
    } finally {
      await app.close();
    }
  }, 30000);
  it('hides blocked or inactive authors and rechecks visibility on direct reads', async () => {
    const p = await post(outsider, false);
    await db.auditLog.create({
      data: {
        actorUserId: member,
        targetType: 'USER',
        targetId: outsider,
        action: 'USER_BLOCKED',
      },
    });
    expect(
      (await arena.feed(viewer(), 'PUBLIC')).data.posts.some(
        (item) => item.id === p.id,
      ),
    ).toBe(false);
    await expect(arena.post(viewer(), p.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      arena.post({ sub: outsider }, (await post(member, false)).id),
    ).rejects.toMatchObject({ status: 404 });
    await db.user.update({
      where: { id: outsider },
      data: { status: 'SUSPENDED' },
    });
    await expect(arena.post({ sub: owner }, p.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('keeps cursor pages stable at matching timestamps and enforces posting limits', async () => {
    const at = new Date(Date.now() + 60000);
    const ids: string[] = Array.from({ length: 26 }, () => randomUUID());
    await db.arenaPost.createMany({
      data: ids.map((id) => ({
        id,
        authorUserId: admin,
        clientRequestId: randomUUID(),
        kind: 'DISCUSSION',
        body: 'Pagination boundary fixture',
        createdAt: at,
      })),
    });
    const first = (await arena.feed({ sub: admin }, 'PUBLIC')).data;
    expect(first.posts).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    const second = (
      await arena.feed({ sub: admin }, 'PUBLIC', undefined, first.nextCursor!)
    ).data;
    expect(
      new Set([...first.posts, ...second.posts].map((p) => p.id)).size,
    ).toBe(first.posts.length + second.posts.length);
    expect(
      [...first.posts, ...second.posts].filter((p) => ids.includes(p.id)),
    ).toHaveLength(26);
    await expect(post(admin, false)).rejects.toMatchObject({ status: 429 });
  });
});
