import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { deduplicateVisibleFixtureRecords } from '../tournaments/fixture-deduplication.js';

const entrySelect = {
  id: true, entryName: true, entryLogoUrl: true,
  members: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { user: { select: {
    id: true, fullName: true, player: { select: { playerCode: true, identity: { select: { inGameName: true } } } },
  } } } },
} satisfies Prisma.TournamentRegistrationSelect;

export interface FeedEntry {
  id: string; entryName: string | null; entryLogoUrl: string | null;
  members: { id: string; fullName: string; playerCode: string | null; inGameName: string | null }[];
}

@Injectable()
export class LeagueFixtureFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(userId: string, leagueId: string, knownVersion?: string) {
    if (knownVersion !== undefined && (typeof knownVersion !== 'string' || !/^[a-f0-9]{24}$/.test(knownVersion))) {
      throw new BadRequestException({ success: false, data: null, error: { code: 'INVALID_FEED_VERSION', message: 'Invalid schedule version.' } });
    }
    // Membership is checked on every read, including unchanged responses.
    const member = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } }, select: { league: { select: { name: true } } },
    });
    if (!member) throw new ForbiddenException({ success: false, data: null, error: {
      code: 'LEAGUE_MEMBERSHIP_REQUIRED', message: 'You must be a member of this League.',
    } });
    const [tournaments, records] = await Promise.all([
      this.prisma.tournament.findMany({ where: { leagueId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, name: true, status: true, competitionFormat: true, legType: true } }),
      this.prisma.fixture.findMany({ where: { tournament: { leagueId } }, orderBy: [{ tournamentId: 'asc' }, { sequence: 'asc' }, { id: 'asc' }],
        select: {
          id: true, tournamentId: true, fixtureCode: true, sequence: true, roundNumber: true, roundName: true,
          matchday: true, phase: true, status: true, scheduledAt: true, venue: true, groupId: true,
          homeRegistrationId: true, awayRegistrationId: true,
          group: { select: { id: true, name: true, position: true } },
          homeRegistration: { select: entrySelect }, awayRegistration: { select: entrySelect },
          match: { select: { id: true, matchCode: true, status: true, confirmedResultSubmissionId: true,
            confirmedResult: { select: { id: true, status: true, homeScore: true, awayScore: true } } } },
        } }),
    ]);
    const byTournament = new Map<string, typeof records>();
    for (const record of records) {
      const list = byTournament.get(record.tournamentId) ?? [];
      list.push(record); byTournament.set(record.tournamentId, list);
    }
    const entries: Record<string, FeedEntry> = {}, groups: Record<string, { id: string; name: string; position: number }> = {};
    const remember = (entry: (typeof records)[number]['homeRegistration']) => {
      if (!entry || entries[entry.id]) return;
      entries[entry.id] = { id: entry.id, entryName: entry.entryName, entryLogoUrl: entry.entryLogoUrl,
        members: entry.members.map(({ user }) => ({ id: user.id, fullName: user.fullName,
          playerCode: user.player?.playerCode ?? null, inGameName: user.player?.identity?.inGameName ?? null })) };
    };
    const fixtures = tournaments.flatMap(tournament => deduplicateVisibleFixtureRecords(
      byTournament.get(tournament.id) ?? [], tournament.competitionFormat, tournament.legType,
    ).map(record => {
      remember(record.homeRegistration); remember(record.awayRegistration);
      if (record.group) groups[record.group.id] = record.group;
      const { homeRegistration: _home, awayRegistration: _away, group: _group, match, ...fixture } = record;
      return { ...fixture, match: match ? { id: match.id, matchCode: match.matchCode, status: match.status,
        confirmedResult: match.confirmedResult ? { homeScore: match.confirmedResult.homeScore, awayScore: match.confirmedResult.awayScore, status: match.confirmedResult.status } : null } : null };
    }));
    // Send each roster once rather than repeating it for every home/away fixture.
    // This read never creates matches or modifies competition records.
    const snapshot = { leagueId, leagueName: member.league.name, tournaments, entries, groups, fixtures };
    const version = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 24);
    return { success: true, data: version === knownVersion ? { unchanged: true as const, version }
      : { unchanged: false as const, version, ...snapshot }, error: null };
  }
}
