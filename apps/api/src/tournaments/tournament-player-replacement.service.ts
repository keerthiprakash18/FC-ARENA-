import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { ReplaceTournamentPlayerDto } from './dto/replace-tournament-player.dto.js';

const conflict = (message: string) => new ConflictException(message);

@Injectable()
export class TournamentPlayerReplacementService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  private async selection(tx: Prisma.TransactionClient, tournamentId: string, registrationId: string, dto: ReplaceTournamentPlayerDto) {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId }, select: { leagueId: true, status: true } });
    if (!tournament) throw new NotFoundException('Tournament could not be found.');
    if (['COMPLETED', 'CANCELLED'].includes(tournament.status)) throw conflict('Players cannot be replaced in a completed or cancelled tournament.');
    const entry = await tx.tournamentRegistration.findUnique({ where: { id: registrationId }, include: {
      group: { select: { name: true } },
      members: { include: { user: { select: { fullName: true, player: { select: { playerCode: true, identity: { select: { inGameName: true } } } } } } } },
    } });
    if (!entry || entry.tournamentId !== tournamentId) throw new NotFoundException('Tournament entry could not be found.');
    if (!['APPROVED', 'PENDING'].includes(entry.status)) throw conflict('Only approved or pending entries can have a replacement player.');
    const outgoing = entry.members.find((member) => member.userId === dto.outgoingUserId);
    if (!outgoing) throw conflict('This player is no longer in the entry. Refresh the teams before replacing a player.');
    const player = await tx.player.findUnique({ where: { playerCode: dto.replacementPlayerCode.trim().toUpperCase() }, select: {
      userId: true, playerCode: true, identity: { select: { inGameName: true } }, user: { select: { fullName: true, status: true } },
    } });
    if (!player) throw new BadRequestException('FC ARENA Player ID could not be found.');
    if (player.userId === outgoing.userId) throw new BadRequestException('Choose a different player to replace this participant.');
    if (player.user.status !== 'ACTIVE') throw conflict('The replacement player must have an active FC ARENA account.');
    const membership = await tx.leagueMember.findUnique({ where: { leagueId_userId: { leagueId: tournament.leagueId, userId: player.userId } }, select: { id: true } });
    if (!membership) throw new BadRequestException('The replacement player must join this league first.');
    const existing = await tx.tournamentRegistrationMember.findUnique({ where: { tournamentId_userId: { tournamentId, userId: player.userId } }, select: { id: true } });
    if (existing) throw conflict('The replacement player already belongs to an entry in this tournament.');
    return { entry, outgoing, player };
  }

  async preview(userId: string, tournamentId: string, registrationId: string, dto: ReplaceTournamentPlayerDto) {
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_PARTICIPANTS');
    const { entry, outgoing, player } = await this.selection(this.prisma, tournamentId, registrationId, dto);
    const fixtureWhere = { tournamentId, OR: [{ homeRegistrationId: registrationId }, { awayRegistrationId: registrationId }] };
    const [fixtureCount, confirmedMatchCount] = await Promise.all([
      this.prisma.fixture.count({ where: fixtureWhere }),
      this.prisma.fixture.count({ where: { ...fixtureWhere, match: { is: { confirmedResultSubmissionId: { not: null } } } } }),
    ]);
    return { success: true, data: {
      entry: { id: entry.id, name: entry.entryName, groupName: entry.group?.name ?? null },
      outgoing: { id: outgoing.userId, name: outgoing.user.player?.identity?.inGameName || outgoing.user.fullName, playerCode: outgoing.user.player?.playerCode ?? null },
      replacement: { id: player.userId, name: player.identity?.inGameName || player.user.fullName, playerCode: player.playerCode },
      fixtureCount, confirmedMatchCount,
    }, error: null };
  }

  async replace(userId: string, tournamentId: string, registrationId: string, dto: ReplaceTournamentPlayerDto) {
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_PARTICIPANTS');
    const replacement = await this.prisma.$transactionWithRetry(async (tx) => {
      // Recheck authorization and roster inside the serializable transaction.
      await new AuthorizationService(tx as PrismaService).assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_PARTICIPANTS');
      const { entry, outgoing, player } = await this.selection(tx, tournamentId, registrationId, dto);

      // Legacy confirmed results may predate APPLY snapshots. Freeze those
      // rosters before changing a member; never rewrite an existing snapshot.
      const matches = await tx.match.findMany({ where: {
        tournamentId, confirmedResultSubmissionId: { not: null }, fixture: { OR: [{ homeRegistrationId: registrationId }, { awayRegistrationId: registrationId }] },
      }, include: { fixture: { include: { homeRegistration: { include: { members: true } }, awayRegistration: { include: { members: true } } } } } });
      for (const match of matches) {
        const side = (entry: typeof match.fixture.homeRegistration) => ({ registrationId: entry?.id ?? null, userIds: entry?.members.map((member) => member.userId) ?? [] });
        await tx.matchResultStatEvent.upsert({ where: { resultSubmissionId_type: { resultSubmissionId: match.confirmedResultSubmissionId!, type: 'APPLY' } },
          create: { tournamentId, matchId: match.id, resultSubmissionId: match.confirmedResultSubmissionId!, type: 'APPLY', payload: { home: side(match.fixture.homeRegistration), away: side(match.fixture.awayRegistration) } }, update: {},
        });
      }
      await tx.tournamentRegistrationMember.update({ where: { id: outgoing.id }, data: { userId: player.userId } });
      // Transfer self-service access when the departing player registered the team.
      if (entry.registeredByUserId === outgoing.userId) {
        await tx.tournamentRegistration.update({ where: { id: registrationId }, data: { registeredByUserId: player.userId } });
      }
      await tx.auditLog.create({ data: {
        actorUserId: userId, action: 'TOURNAMENT_PLAYER_REPLACED', targetType: 'TournamentRegistration', targetId: registrationId, scopeType: 'TOURNAMENT', scopeId: tournamentId,
        beforeData: { userId: outgoing.userId, playerCode: outgoing.user.player?.playerCode ?? null, registeredByUserId: entry.registeredByUserId },
        afterData: { userId: player.userId, playerCode: player.playerCode },
        metadata: { reason: dto.reason?.trim() || 'Player unavailable', groupId: entry.groupId, entryName: entry.entryName },
      } });
      return { id: player.userId, name: player.identity?.inGameName || player.user.fullName, playerCode: player.playerCode };
    }, { isolationLevel: 'Serializable', timeout: 15000 });
    return { success: true, data: { replacement, message: 'Player replaced. Groups, fixtures, scores and team points are preserved.' }, error: null };
  }
}
