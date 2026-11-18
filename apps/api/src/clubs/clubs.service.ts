import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateClubDto } from './clubs.dto.js';

function hashInvite(code: string): string {
  return createHash('sha256').update(code.toLowerCase(), 'utf8').digest('hex');
}

function issueInvite() {
  const inviteCode = randomBytes(12).toString('hex');
  return { inviteCode, inviteHash: hashInvite(inviteCode) };
}

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('Active player account required.');
  }

  async list(userId: string) {
    await this.requireActive(userId);
    const clubs = await this.prisma.arenaClub.findMany({
      select: {
        id: true, slug: true, name: true, description: true, createdAt: true,
        ownerUserId: true, _count: { select: { members: true, entries: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { success: true, data: { clubs: clubs.map(c => ({
      ...c, myClub: c.ownerUserId === userId,
    })) }, error: null };
  }

  async create(userId: string, dto: CreateClubDto) {
    await this.requireActive(userId);
    const name = dto.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const description = dto.description?.normalize('NFKC').trim() || null;
    if (name.length < 3 || name.length > 80) throw new BadRequestException('Club name must contain 3-80 characters.');
    if (description && description.length > 400) throw new BadRequestException('Description is too long.');
    const owned = await this.prisma.arenaClub.count({ where: { ownerUserId: userId } });
    if (owned >= 3) throw new ConflictException('Maximum of 3 clubs per captain.');
    const slugStem = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'arena-club';
    const slug = slugStem + '-' + randomBytes(4).toString('hex');
    const invite = issueInvite();
    const club = await this.prisma.$transactionWithRetry(async tx => {
      const created = await tx.arenaClub.create({
        data: { name, description, slug, ownerUserId: userId, inviteHash: invite.inviteHash,
          members: { create: { userId } } },
        select: { id: true, name: true, slug: true },
      });
      await tx.auditLog.create({ data: {
        actorUserId: userId, action: 'ARENA_CLUB_CREATED', targetType: 'ARENA_CLUB', targetId: created.id,
        afterData: { name: created.name, slug: created.slug },
      } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    // The code is returned once and stored only as a salted-independent SHA-256 digest.
    return { success: true, data: { club, inviteCode: invite.inviteCode }, error: null };
  }

  async join(userId: string, inviteCode: string) {
    await this.requireActive(userId);
    const normalized = inviteCode.trim().toLowerCase();
    if (!/^[0-9a-f]{24}$/.test(normalized)) throw new BadRequestException('Invalid invitation code.');
    const club = await this.prisma.arenaClub.findUnique({ where: { inviteHash: hashInvite(normalized) },
      select: { id: true, slug: true, name: true } });
    if (!club) throw new NotFoundException('Invitation is invalid or has expired.');
    await this.prisma.$transactionWithRetry(async tx => {
      const alreadyMember = await tx.arenaClubMember.findUnique({
        where: { clubId_userId: { clubId: club.id, userId } }, select: { userId: true },
      });
      if (alreadyMember) throw new ConflictException('You are already a club member.');
      await tx.arenaClubMember.create({ data: { clubId: club.id, userId } });
      await tx.auditLog.create({ data: {
        actorUserId: userId, action: 'ARENA_CLUB_JOINED', targetType: 'ARENA_CLUB', targetId: club.id,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true, data: { club }, error: null };
  }

  async rotateInvite(userId: string, clubId: string) {
    await this.requireActive(userId);
    const invite = issueInvite();
    const changed = await this.prisma.arenaClub.updateMany({
      where: { id: clubId, ownerUserId: userId }, data: { inviteHash: invite.inviteHash },
    });
    if (changed.count === 0) throw new ForbiddenException('Only the club captain can regenerate an invitation.');
    await this.prisma.auditLog.create({ data: {
      actorUserId: userId, action: 'ARENA_CLUB_INVITE_ROTATED', targetType: 'ARENA_CLUB', targetId: clubId,
    } });
    return { success: true, data: { inviteCode: invite.inviteCode }, error: null };
  }

  async details(userId: string, slug: string) {
    await this.requireActive(userId);
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new NotFoundException('Club not found.');
    const club = await this.prisma.arenaClub.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, description: true, ownerUserId: true, createdAt: true,
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            userId: true,
            joinedAt: true,
            user: {
              select: {
                fullName: true,
                player: {
                  select: {
                    playerCode: true,
                    profileImageUrl: true,
                    identity: { select: { inGameName: true } },
                  },
                },
              },
            },
          },
        },
        entries: {
          orderBy: { linkedAt: 'desc' },
          select: {
            registrationId: true,
            linkedAt: true,
            registration: {
              select: {
                entryName: true,
                entryLogoUrl: true,
                status: true,
                tournament: { select: { id: true, name: true, mode: true, status: true } },
              },
            },
          },
        },
      },
    });
    if (!club) throw new NotFoundException('Club not found.');
    const registrationIds = club.entries.map(e => e.registrationId);
    const confirmed = registrationIds.length ? await this.prisma.fixture.findMany({
      where: {
        OR: [ { homeRegistrationId: { in: registrationIds } }, { awayRegistrationId: { in: registrationIds } } ],
        match: { is: { confirmedResultSubmissionId: { not: null } } },
      },
      select: { homeRegistrationId: true, awayRegistrationId: true,
        match: { select: { confirmedResult: { select: {
          homeScore: true, awayScore: true, homePenaltyScore: true, awayPenaltyScore: true, status: true,
        } } } },
      },
    }) : [];
    const linked = new Set(registrationIds);
    const stats = { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
    for (const fixture of confirmed) {
      const result = fixture.match?.confirmedResult;
      if (!result || result.status !== 'CONFIRMED') continue;
      const home = !!fixture.homeRegistrationId && linked.has(fixture.homeRegistrationId);
      const away = !!fixture.awayRegistrationId && linked.has(fixture.awayRegistrationId);
      if (home === away) continue; // Never attribute a self-match to both sides.
      stats.matches++;
      stats.goalsFor += home ? result.homeScore : result.awayScore;
      stats.goalsAgainst += home ? result.awayScore : result.homeScore;
      const scoreDiff = home ? result.homeScore - result.awayScore : result.awayScore - result.homeScore;
      const penaltyDiff = (result.homePenaltyScore != null && result.awayPenaltyScore != null)
        ? (home ? result.homePenaltyScore - result.awayPenaltyScore : result.awayPenaltyScore - result.homePenaltyScore) : 0;
      if (scoreDiff > 0 || (scoreDiff === 0 && penaltyDiff > 0)) stats.wins++;
      else if (scoreDiff < 0 || (scoreDiff === 0 && penaltyDiff < 0)) stats.losses++;
      else stats.draws++;
    }
    return { success: true, data: {
      club: { ...club, isCaptain: club.ownerUserId === userId,
        isMember: club.members.some(m => m.userId === userId) },
      stats: { ...stats, winRate: stats.matches ? Math.round(stats.wins / stats.matches * 100) : 0 },
    }, error: null };
  }

  async linkableEntries(userId: string, clubId: string) {
    await this.requireActive(userId);
    const club = await this.prisma.arenaClub.findUnique({
      where: { id: clubId }, select: { ownerUserId: true,
        members: { select: { userId: true } } },
    });
    if (!club || club.ownerUserId !== userId) throw new ForbiddenException('Only a club captain can link a team.');
    const roster = new Set(club.members.map(m => m.userId));
    const registrations = await this.prisma.tournamentRegistration.findMany({
      where: { status: 'APPROVED',
        members: { some: { userId } },
        arenaClubEntry: { is: null },
        tournament: { mode: { in: ['DUO','TEAM'] }, status: { notIn: ['COMPLETED','CANCELLED'] } },
      },
      select: { id: true, entryName: true,
        members: { select: { userId: true } },
        tournament: { select: { id: true, name: true, mode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const entries = registrations.filter(r => r.members.length > 0 && r.members.every(m => roster.has(m.userId)))
      .map(r => ({ id: r.id, entryName: r.entryName || r.tournament.name,
        tournamentName: r.tournament.name, tournamentId: r.tournament.id, mode: r.tournament.mode }));
    return { success: true, data: { entries }, error: null };
  }

  /**
   * A captain explicitly binds an approved DUO/TEAM registration to a permanent club.
   * Verified past matches may never be retroactively claimed for a new club.
   */
  async linkEntry(userId: string, clubId: string, registrationId: string) {
    await this.requireActive(userId);
    const linked = await this.prisma.$transactionWithRetry(async tx => {
      const [club, registration] = await Promise.all([
        tx.arenaClub.findUnique({ where: { id: clubId }, select: { id: true, ownerUserId: true } }),
        tx.tournamentRegistration.findUnique({ where: { id: registrationId },
          select: { id: true, status: true, tournament: { select: { mode: true, status: true } },
            members: { select: { userId: true } }, arenaClubEntry: { select: { clubId: true } } } }),
      ]);
      if (!club || !registration) throw new NotFoundException('Club or tournament entry not found.');
      if (club.ownerUserId !== userId) throw new ForbiddenException('Only the club captain can link a team.');
      if (registration.tournament.mode === 'SOLO' || registration.status !== 'APPROVED' ||
          ['COMPLETED','CANCELLED'].includes(registration.tournament.status)) {
        throw new BadRequestException('Only active, approved DUO or TEAM entries may be linked.');
      }
      if (registration.arenaClubEntry) throw new ConflictException('This tournament entry is already linked.');
      if (!registration.members.some(m => m.userId === userId)) {
        throw new ForbiddenException('The club captain must be a registered member of the team.');
      }
      if (!registration.members.length) throw new BadRequestException('Team roster must not be empty.');
      const roster = await tx.arenaClubMember.count({
        where: { clubId, userId: { in: registration.members.map(m => m.userId) } },
      });
      if (roster !== registration.members.length) throw new BadRequestException('All registered teammates must join the club before linking.');
      const previousVerifiedMatches = await tx.fixture.count({
        where: {
          OR: [{ homeRegistrationId: registrationId }, { awayRegistrationId: registrationId }],
          match: { is: { confirmedResultSubmissionId: { not: null } } },
        },
      });
      if (previousVerifiedMatches) throw new ConflictException('Cannot claim a tournament entry after verified match results exist.');
      await tx.arenaClubEntry.create({ data: { clubId, registrationId } });
      await tx.auditLog.create({ data: {
        actorUserId: userId, action: 'ARENA_CLUB_ENTRY_LINKED', targetType: 'ARENA_CLUB',
        targetId: clubId, afterData: { registrationId },
      } });
      return { clubId, registrationId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true, data: { linked }, error: null };
  }
}
