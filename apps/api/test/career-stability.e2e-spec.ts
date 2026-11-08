import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { NotificationsModule } from '../src/notifications/notifications.module.js';
import { RegistrationNotificationsService } from '../src/notifications/registration-notifications.service.js';
import { PlayerCareerController } from '../src/player-career/player-career.controller.js';
import { PlayerCareerService } from '../src/player-career/player-career.service.js';
import { PlayerDashboardService } from '../src/player-career/player-dashboard.service.js';
import { PlayerProfileImageService } from '../src/player-career/player-profile-image.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { TournamentEntriesService } from '../src/tournaments/tournament-entries.service.js';
import { FixturesService } from '../src/tournaments/fixtures.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';

describe('Two-league career, owner registration access and notifications', () => {
  const run = randomUUID().slice(0, 8),
    users = Array.from({ length: 7 }, () => randomUUID());
  const [owner, creator, player, opponent, fixtureAdmin, otherOwner, teammate] =
    users;
  let app: INestApplication,
    db: PrismaService,
    authorization: AuthorizationService,
    notifier: RegistrationNotificationsService;
  let tournaments: TournamentsService,
    leagues: string[],
    cups: string[],
    pendingId: string;
  const registrations: string[][] = [];
  let sequence = 0;
  const access = () =>
    new JwtService().sign(
      {
        sub: player,
        email: 'career@example.invalid',
        role: 'USER',
        type: 'access',
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 600 },
    );
  const career = (leagueId?: string, extra: object = {}) =>
    request(app.getHttpServer())
      .get('/api/players/me/career')
      .set('Authorization', 'Bearer ' + access())
      .query({ ...(leagueId ? { leagueId } : {}), ...extra });
  async function played(
    cup: string,
    home: string,
    away: string,
    homeScore: number,
    awayScore: number,
  ) {
    const fixture = await db.fixture.create({
      data: {
        tournamentId: cup,
        fixtureCode: `CS-${run}-${++sequence}`,
        sequence,
        roundNumber: sequence,
        roundName: 'Verified round',
        bracketPosition: sequence,
        matchday: sequence,
        homeRegistrationId: home,
        awayRegistrationId: away,
        status: 'COMPLETED',
        publishedAt: new Date(),
        match: { create: { tournamentId: cup, status: 'COMPLETED' } },
      },
      include: { match: true },
    });
    const result = await db.resultSubmission.create({
      data: {
        matchId: fixture.match!.id,
        submittedByUserId: player,
        reviewedByUserId: owner,
        homeScore,
        awayScore,
        status: 'CONFIRMED',
        reviewedAt: new Date(),
      },
    });
    await db.match.update({
      where: { id: fixture.match!.id },
      data: { confirmedResultSubmissionId: result.id },
    });
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Requires a disposable loopback *_test database.');
    process.env.JWT_ACCESS_SECRET = 'career-test-' + run;
    process.env.JWT_REFRESH_SECRET = 'career-refresh-' + run;
    process.env.PUSH_ENABLED = 'false';
    const module = await Test.createTestingModule({
      imports: [PrismaModule, SecurityModule, AuthModule, NotificationsModule],
      controllers: [PlayerCareerController],
      providers: [
        PlayerCareerService,
        { provide: PlayerDashboardService, useValue: {} },
        { provide: PlayerProfileImageService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    db = app.get(PrismaService);
    authorization = app.get(AuthorizationService);
    notifier = app.get(RegistrationNotificationsService);
    tournaments = new TournamentsService(db, authorization, notifier);
    for (const [index, id] of users.entries())
      await db.user.create({
        data: {
          id,
          email: `career-${run}-${index}@example.invalid`,
          fullName: `Career Test ${index}`,
          passwordHash: 'not-a-login-hash',
          status: 'ACTIVE',
          player: {
            create: {
              playerCode: `CS-${run}-${index}`,
              identity: {
                create: {
                  inGameName: `Career Test ${index}`,
                  inGameNameNormalized: `career test ${index}`,
                  isVerified: true,
                },
              },
            },
          },
        },
      });
    leagues = [];
    for (let i = 0; i < 2; i++)
      leagues.push(
        (
          await db.league.create({
            data: {
              name: `Career League ${i}`,
              code: `CS${run}${i}`,
              creatorUserId: i === 0 ? owner : otherOwner,
            },
          })
        ).id,
      );
    await db.leagueAdmin.createMany({
      data: [
        { leagueId: leagues[0], userId: owner, role: 'OWNER' },
        {
          leagueId: leagues[0],
          userId: creator,
          role: 'ADMIN',
          permissions: ['MANAGE_TOURNAMENTS'],
        },
        { leagueId: leagues[1], userId: otherOwner, role: 'OWNER' },
      ],
    });
    await db.leagueMember.createMany({
      data: [creator, player, opponent, fixtureAdmin, teammate]
        .map((userId) => ({
          leagueId: leagues[0],
          userId,
          type: 'PRIMARY' as const,
        }))
        .concat(
          [player, opponent].map((userId) => ({
            leagueId: leagues[1],
            userId,
            type: 'SECONDARY' as any,
          })),
        ),
    });
    cups = [];
    for (let i = 0; i < 3; i++)
      cups.push(
        (
          await db.tournament.create({
            data: {
              leagueId: leagues[i === 1 ? 1 : 0],
              createdByUserId: creator,
              name: `Career Cup ${i}`,
              code: `CS${run}${i}`,
              mode: 'SOLO',
              format: 'ROUND_ROBIN',
              teamSize: 1,
              maxEntries: 24,
              registrationMode: 'APPROVAL',
              status: i < 2 ? 'COMPLETED' : 'REGISTRATION_OPEN',
            },
          })
        ).id,
      );
    await db.tournamentAdmin.create({
      data: {
        tournamentId: cups[2],
        userId: fixtureAdmin,
        role: 'ADMIN',
        permissions: ['MANAGE_FIXTURES'],
      },
    });
    const scores = [
      Array.from({ length: 10 }, (_, i) =>
        i < 6 ? [2, 0] : i < 8 ? [1, 1] : [0, 2],
      ),
      Array.from({ length: 6 }, (_, i) =>
        i === 0 ? [3, 0] : i === 1 ? [2, 2] : [0, 1],
      ),
    ];
    for (let i = 0; i < 2; i++) {
      registrations[i] = [];
      for (const userId of [player, opponent])
        registrations[i].push(
          (
            await db.tournamentRegistration.create({
              data: {
                tournamentId: cups[i],
                registeredByUserId: userId,
                status: 'APPROVED',
                members: { create: { tournamentId: cups[i], userId } },
              },
            })
          ).id,
        );
      for (const [homeScore, awayScore] of scores[i])
        await played(
          cups[i],
          registrations[i][0],
          registrations[i][1],
          homeScore,
          awayScore,
        );
      const wins = scores[i].filter(([a, b]) => a > b).length,
        draws = scores[i].filter(([a, b]) => a === b).length;
      await db.playerTournamentStatistic.create({
        data: {
          tournamentId: cups[i],
          userId: player,
          matches: scores[i].length,
          wins,
          draws,
          losses: scores[i].length - wins - draws,
          goalsFor: scores[i].reduce((n, [a]) => n + a, 0),
          goalsAgainst: scores[i].reduce((n, [, b]) => n + b, 0),
          goalDifference: scores[i].reduce((n, [a, b]) => n + a - b, 0),
          form: 'WWDDL',
        },
      });
      await db.achievement.create({
        data: {
          userId: player,
          tournamentId: cups[i],
          type: 'TOURNAMENT_PARTICIPATION',
          title: `Cup ${i} participation`,
        },
      });
    }
    for (let i = 0; i < 19; i++)
      await db.tournamentRegistration.create({
        data: {
          tournamentId: cups[2],
          registeredByUserId: creator,
          entryName: `Already approved ${i}`,
          status: 'APPROVED',
        },
      });
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  it('preserves overall totals while isolating each league and its full history/awards', async () => {
    const all = await career();
    expect(all.status).toBe(200);
    expect(all.body.data.lifetimeStatistics).toMatchObject({
      matches: 16,
      wins: 7,
      draws: 3,
      losses: 6,
      goalsFor: 19,
      goalsAgainst: 12,
      winRate: 43.8,
    });
    expect(all.body.data.availableLeagues).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      const scoped = await career(leagues[i]);
      expect(scoped.status).toBe(200);
      expect(scoped.body.data.lifetimeStatistics.matches).toBe(
        i === 0 ? 10 : 6,
      );
      expect(
        scoped.body.data.matchHistory.every(
          (row: any) => row.tournament.league.id === leagues[i],
        ),
      ).toBe(true);
      expect(scoped.body.data.tournamentHistory).toHaveLength(1);
      expect(scoped.body.data.achievements).toHaveLength(1);
      expect(scoped.body.data.scope.leagueId).toBe(leagues[i]);
      expect(scoped.body.data.availableLeagues).toHaveLength(2);
    }
  });
  it('rejects foreign scope, malformed IDs and another-account injection', async () => {
    expect((await career(randomUUID())).status).toBe(403);
    expect((await career('not-a-league-id')).status).toBe(400);
    expect((await career(leagues[0], { userId: owner })).status).toBe(400);
    expect(
      (await request(app.getHttpServer()).get('/api/players/me/career')).status,
    ).toBe(401);
  });
  it('lets a non-player league owner review another creator’s registration without granting outsiders access', async () => {
    const registered = await tournaments.register(player, cups[2], {
      inGameName: 'Career Test 2',
      entryName: 'New pending team',
    });
    pendingId = registered.data.registration.id;
    const overview = (await tournaments.getTournament(owner, cups[2])).data
      .tournament;
    expect(overview).toMatchObject({
      canManageParticipants: true,
      canManageAdmins: true,
      approvedEntries: 19,
      pendingEntries: 1,
      registeredEntries: 20,
    });
    expect(
      (await tournaments.getRegistrations(owner, cups[2])).data.registrations,
    ).toHaveLength(20);
    expect(
      (await tournaments.getMyRegistration(owner, cups[2])).data.registration,
    ).toBe(null);
    expect(
      (
        await new TournamentEntriesService(db, authorization).listEntries(
          owner,
          cups[2],
        )
      ).data.entries,
    ).toHaveLength(20);
    expect(
      (
        await new FixturesService(db, authorization, {
          publish: () => {},
        } as any).getFixtures(owner, cups[2])
      ).data.fixtures,
    ).toHaveLength(0);
    await expect(
      tournaments.getRegistrations(otherOwner, cups[2]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      tournaments.getRegistrations(fixtureAdmin, cups[2]),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await tournaments.getTournament(fixtureAdmin, cups[2])).data.tournament
        .canManageParticipants,
    ).toBe(false);
  });
  it('creates deduplicated inbox alerts for the correct reviewers and participant', async () => {
    let notices = await db.notification.findMany({
      where: { entityId: pendingId },
    });
    expect(
      notices
        .filter((row) => row.type === 'TOURNAMENT_REGISTRATION_RECEIVED')
        .map((row) => row.userId)
        .sort(),
    ).toEqual([owner, creator].sort());
    expect(
      notices.some(
        (row) =>
          row.userId === player &&
          row.type === 'TOURNAMENT_APPLICATION_SUBMITTED',
      ),
    ).toBe(true);
    expect(
      notices.some(
        (row) => row.userId === fixtureAdmin || row.userId === otherOwner,
      ),
    ).toBe(false);
    const own = notices.find((row) => row.userId === owner)!;
    await db.notification.update({
      where: { id: own.id },
      data: { readAt: new Date() },
    });
    await notifier.tick();
    await notifier.notify(pendingId);
    notices = await db.notification.findMany({
      where: { entityId: pendingId },
    });
    expect(notices).toHaveLength(3);
    expect(notices.find((row) => row.id === own.id)?.readAt).not.toBe(null);
  });
  it('approval sends the final decision and archives the pending participant message', async () => {
    await tournaments.approveRegistration(owner, cups[2], pendingId);
    expect(
      (await tournaments.getTournament(owner, cups[2])).data.tournament,
    ).toMatchObject({
      approvedEntries: 20,
      pendingEntries: 0,
      registeredEntries: 20,
    });
    expect(
      await db.notification.count({
        where: {
          userId: player,
          entityId: pendingId,
          type: 'TOURNAMENT_APPLICATION_APPROVED',
        },
      }),
    ).toBe(1);
    expect(
      await db.notification.count({
        where: {
          userId: player,
          entityId: pendingId,
          type: 'TOURNAMENT_APPLICATION_SUBMITTED',
          readAt: null,
        },
      }),
    ).toBe(0);
  });
  it('keeps a committed registration successful during notification failure and retries it later', async () => {
    const failing = new TournamentsService(db, authorization, {
      notify: async () => {
        throw Error('temporary notifier failure');
      },
    } as any);
    const result = await failing.register(fixtureAdmin, cups[2], {
      inGameName: 'Career Test 4',
      entryName: 'Saved during outage',
    });
    expect(result.success).toBe(true);
    expect(
      await db.tournamentRegistration.count({
        where: { id: result.data.registration.id },
      }),
    ).toBe(1);
    await notifier.tick();
    expect(
      await db.notification.count({
        where: { entityId: result.data.registration.id },
      }),
    ).toBe(3);
  });
  it('notifies every rejected teammate even after their registration slots are released', async () => {
    const cup = await db.tournament.create({
      data: {
        leagueId: leagues[0],
        createdByUserId: creator,
        name: 'Team decision test',
        code: `CD${run}`,
        mode: 'DUO',
        format: 'ROUND_ROBIN',
        teamSize: 2,
        maxEntries: 4,
        status: 'REGISTRATION_OPEN',
      },
    });
    const entry = await db.tournamentRegistration.create({
      data: {
        tournamentId: cup.id,
        registeredByUserId: player,
        status: 'PENDING',
        members: {
          create: [player, teammate].map((userId) => ({
            tournamentId: cup.id,
            userId,
          })),
        },
      },
    });
    await notifier.notify(entry.id);
    await new TournamentsService(db, authorization, {
      notify: async () => { throw Error('temporary decision delivery failure'); },
    } as any).rejectRegistration(owner, cup.id, entry.id);
    await notifier.tick();
    expect(
      await db.tournamentRegistrationMember.count({
        where: { registrationId: entry.id },
      }),
    ).toBe(0);
    const decisions = await db.notification.findMany({
      where: { entityId: entry.id, type: 'TOURNAMENT_APPLICATION_REJECTED' },
    });
    expect(decisions.map((row) => row.userId).sort()).toEqual(
      [player, teammate].sort(),
    );
  });
  it('filters league history before its row limit instead of filtering the newest overall rows', async () => {
    for (let i = 0; i < 101; i++)
      await played(cups[0], registrations[0][0], registrations[0][1], 1, 0);
    await db.playerTournamentStatistic.updateMany({
      where: { tournamentId: cups[0], userId: player },
      data: {
        matches: { increment: 101 },
        wins: { increment: 101 },
        goalsFor: { increment: 101 },
        goalDifference: { increment: 101 },
      },
    });
    expect((await career()).body.data.matchHistory).toHaveLength(100);
    const second = await career(leagues[1]);
    expect(second.body.data.lifetimeStatistics.matches).toBe(6);
    expect(second.body.data.matchHistory).toHaveLength(6);
  }, 45_000);
});
