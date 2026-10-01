import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { LeaguesService } from '../leagues/leagues.service.js';
import { PlayerCareerService } from './player-career.service.js';

@Injectable()
export class PlayerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leagues: LeaguesService,
    private readonly career: PlayerCareerService,
  ) {}

  async getSummary(userId: string) {
    const [career, memberships] = await Promise.all([
      this.career.getMyCareer(userId, true),
      this.leagues.getMyLeagues(userId),
    ]);
    const leagueIds = memberships.data.leagues.map(
      (member) => member.league.id,
    );
    const now = new Date();
    const entrySelect = {
      id: true,
      entryName: true,
      members: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              player: {
                select: { identity: { select: { inGameName: true } } },
              },
            },
          },
        },
      },
    } as const;
    const select = {
      id: true,
      sequence: true,
      matchday: true,
      roundName: true,
      status: true,
      scheduledAt: true,
      homeRegistration: { select: entrySelect },
      awayRegistration: { select: entrySelect },
      match: { select: { id: true, status: true } },
      tournament: {
        select: { id: true, name: true, league: { select: { name: true } } },
      },
    } as const;
    // Scope by current membership AND account identity; never download other players' schedules.
    const where: Prisma.FixtureWhereInput = {
      tournament: {
        leagueId: { in: leagueIds },
        status: { notIn: ['COMPLETED', 'CANCELLED', 'DRAFT'] },
      },
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      AND: [
        {
          OR: [
            { match: null },
            { match: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
          ],
        },
      ],
      OR: [
        { homeRegistration: { members: { some: { userId } } } },
        { awayRegistration: { members: { some: { userId } } } },
      ],
    };
    // Fixed query count and bounded payload even as league tournament history grows.
    const [tournaments, future, unscheduled, overdue] = await Promise.all([
      this.prisma.tournament.findMany({
        where: {
          leagueId: { in: leagueIds },
          status: { notIn: ['COMPLETED', 'CANCELLED', 'DRAFT'] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
        select: {
          id: true,
          name: true,
          code: true,
          logoUrl: true,
          status: true,
          format: true,
          competitionFormat: true,
          maxEntries: true,
          startAt: true,
          leagueId: true,
          league: { select: { name: true } },
          _count: {
            select: { registrations: { where: { status: 'APPROVED' } } },
          },
        },
      }),
      this.prisma.fixture.findMany({
        where: { ...where, scheduledAt: { gte: now } },
        select,
        take: 10,
        orderBy: [{ scheduledAt: 'asc' }, { sequence: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.fixture.findMany({
        where: { ...where, scheduledAt: null },
        select,
        take: 10,
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.fixture.findMany({
        where: { ...where, scheduledAt: { lt: now } },
        select,
        take: 10,
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const mapEntry = (entry: (typeof future)[number]['homeRegistration']) =>
      entry && {
        id: entry.id,
        entryName: entry.entryName,
        members: entry.members.map(({ user }) => ({
          id: user.id,
          fullName: user.fullName,
          inGameName: user.player?.identity?.inGameName ?? null,
        })),
      };
    return {
      success: true,
      error: null,
      data: {
        career: {
          profile: career.data.profile,
          lifetimeStatistics: career.data.lifetimeStatistics,
          tournamentHistory: career.data.tournamentHistory.map((entry) => ({
            tournament: { id: entry.tournament.id },
            registration: {
              id: entry.registration.id,
              entryName: entry.registration.entryName,
            },
          })),
          matchHistory: career.data.matchHistory,
        },
        memberships: memberships.data.leagues,
        tournaments: tournaments.map(({ league, _count, ...tournament }) => ({
          ...tournament,
          leagueName: league.name,
          approvedEntries: _count.registrations,
        })),
        fixtures: [...future, ...unscheduled, ...overdue].map(
          ({ homeRegistration, awayRegistration, tournament, ...fixture }) => ({
            ...fixture,
            home: mapEntry(homeRegistration),
            away: mapEntry(awayRegistration),
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            leagueName: tournament.league.name,
          }),
        ),
      },
    };
  }
}
