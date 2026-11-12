import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';

const FULL_PERMISSIONS = [
  'MANAGE_FIXTURES', 'MANAGE_RESULTS', 'VERIFY_SCORES',
  'MANAGE_PARTICIPANTS', 'MANAGE_SETTINGS', 'VIEW_REPORTS',
] as const;

/**
 * Cryptographically shuffle a copy of the approved entry set before the balanced
 * round-robin group assignment. Injecting a draw function makes this testable.
 * The original registration order and tournament records are never mutated.
 */
export function shuffleApprovedEntries<T>(
  entries: readonly T[],
  drawIndex: (maxExclusive: number) => number = randomInt,
): T[] {
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = drawIndex(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new RangeError('The draw function returned an invalid index.');
    }
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/**
 * Keep the original tournament/fixtures/results intact.
 * Restarting creates a NEW tournament with the same approved participants
 * and a newly balanced, editable group draw, so scores, disputes and awards are never destroyed.
 */
@Injectable()
export class TournamentDrawRestartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private async assertPermissions(userId: string, tournamentId: string) {
    for (const permission of ['MANAGE_SETTINGS', 'MANAGE_PARTICIPANTS', 'MANAGE_FIXTURES'] as const) {
      await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, permission);
    }
  }

  async preview(userId: string, tournamentId: string) {
    await this.assertPermissions(userId, tournamentId);
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true, name: true, code: true,
        groupMode: true, _count: {
          select: {
            groups: true,
            fixtures: true,
            registrations: { where: { status: 'APPROVED' } },
          },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found.');
    return {
      success: true,
      data: {
        sourceTournamentId: tournament.id,
        tournamentName: tournament.name,
        oldTournamentCode: tournament.code,
        approvedTeamsToCarry: tournament._count.registrations,
        groupsToSetUp: tournament.groupMode === 'MULTIPLE_GROUPS'
          ? Math.min(16, Math.max(2, tournament._count.groups), Math.floor(tournament._count.registrations / 2)) : 0,
        historicalFixturesKept: tournament._count.fixtures,
        originalHistoryPreserved: true,
        createsNewTournament: true,
      },
      error: null,
    };
  }

  async restart(userId: string, tournamentId: string, confirmation: string | undefined) {
    await this.assertPermissions(userId, tournamentId);
    if (typeof confirmation !== 'string' || !confirmation.trim()) {
      throw new BadRequestException('Type the exact tournament name to confirm restarting.');
    }
    const result = await this.prisma.$transactionWithRetry(async tx => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;
      const auth = new AuthorizationService(tx as unknown as PrismaService);
      for (const permission of ['MANAGE_SETTINGS', 'MANAGE_PARTICIPANTS', 'MANAGE_FIXTURES'] as const) {
        await auth.assertCanManageTournamentPermission(userId, tournamentId, permission);
      }
      const source = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          admins: { select: { userId: true, role: true, permissions: true } },
          registrations: {
            where: { status: 'APPROVED' },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true, entryName: true, entryLogoUrl: true, sortOrder: true,
              registeredByUserId: true,
              members: { select: { userId: true } },
            },
          },
          groups: { select: { id: true }, orderBy: { position: 'asc' } },
        },
      });
      if (!source) throw new NotFoundException('Tournament not found.');
      if (source.name !== confirmation) {
        throw new BadRequestException('Tournament name confirmation does not match.');
      }
      if (source.registrations.length === 0) {
        throw new BadRequestException('No approved teams exist to carry to the new draw.');
      }

      // Never modify or delete the source tournament, its awards or recorded results.
      // This produces a distinct URL and tournament code; the old one remains a record.
      const duplicate = await tx.auditLog.findFirst({
        where: {
          action: 'TOURNAMENT_DRAW_RESTART_WITH_TEAMS',
          targetType: 'Tournament',
          targetId: tournamentId,
        },
        orderBy: { createdAt: 'desc' },
        select: { afterData: true },
      });
      if (duplicate && duplicate.afterData && typeof duplicate.afterData === 'object' &&
        'newTournamentId' in duplicate.afterData &&
        typeof duplicate.afterData.newTournamentId === 'string') {
        const alreadyExists = await tx.tournament.findUnique({
          where: { id: duplicate.afterData.newTournamentId },
          select: { id: true, name: true, code: true },
        });
        if (alreadyExists) {
          return {
            tournamentId: alreadyExists.id,
            tournamentName: alreadyExists.name,
            tournamentCode: alreadyExists.code,
            carriedTeams: source.registrations.length,
            groupCount: source.groups.length,
            alreadyCreated: true,
          };
        }
      }

      const freshId = randomUUID();
      const groupCount = source.groupMode === 'MULTIPLE_GROUPS'
        ? Math.min(16, Math.max(2, source.groups.length), Math.floor(source.registrations.length / 2))
        : 0;
      if (source.groupMode === 'MULTIPLE_GROUPS' && groupCount < 2) {
        throw new BadRequestException('At least four approved teams are needed for two playable groups.');
      }
      const fresh = await tx.tournament.create({
        data: {
          id: freshId,
          code: `FCA-T-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
          leagueId: source.leagueId,
          createdByUserId: userId,
          name: `${source.name.slice(0, 107)} (New Draw)`,
          description: source.description,
          rules: source.rules,
          mode: source.mode,
          format: source.format,
          competitionFormat: source.competitionFormat,
          groupMode: source.groupMode,
          legType: source.legType,
          fixtureMode: source.fixtureMode,
          visibility: source.visibility,
          registrationMode: source.registrationMode,
          teamSize: source.teamSize,
          maxEntries: Math.max(source.maxEntries, source.registrations.length),
          logoUrl: source.logoUrl,
          startAt: null,
          endAt: null,
          status: 'REGISTRATION_CLOSED',
          wizardStep: source.groupMode === 'MULTIPLE_GROUPS' ? 'GROUPS' : 'FIXTURE_SETTINGS',
          registrationClosedAt: new Date(),
          qualifiersPerGroup: null,
          playoffQualifiersTotal: null,
          playoffPairingMethod: source.playoffPairingMethod,
          playoffFormat: source.playoffFormat,
          playoffSource: source.playoffSource,
          playoffSeedingBasis: source.playoffSeedingBasis,
          avoidSameGroupEarly: source.avoidSameGroupEarly,
          dailyMatchLimit: source.dailyMatchLimit,
          matchesPerParticipantPerDay: source.matchesPerParticipantPerDay,
          matchDurationMinutes: source.matchDurationMinutes,
          resultDeadlineHours: source.resultDeadlineHours,
          maxAdmins: source.maxAdmins,
        },
      });

      const admins = new Map(source.admins.map(a => [a.userId, a]));
      await tx.tournamentAdmin.createMany({
        data: [
          {
            tournamentId: fresh.id, userId,
            role: 'OWNER', permissions: [...FULL_PERMISSIONS],
          },
          ...[...admins.values()]
            .filter(admin => admin.userId !== userId)
            .map(admin => ({
              tournamentId: fresh.id,
              userId: admin.userId,
              role: 'ADMIN' as const,
              permissions: admin.permissions,
            })),
        ],
      });

      // Generate the replacement groups FIRST, so each newly copied team
      // receives a valid group FK immediately. Randomize approved entries and
      // distribute them evenly: 42 / 7 => six entries per group.
      const groupRows = Array.from({ length: groupCount }, (_, index) => ({
        id: randomUUID(),
        tournamentId: fresh.id,
        name: `Group ${String.fromCharCode(65 + index)}`,
        position: index + 1,
      }));
      if (groupRows.length > 0) {
        await tx.tournamentGroup.createMany({ data: groupRows });
      }

      // A fresh draw must not simply recreate the old registration-order groups.
      const randomizedApprovedEntries = shuffleApprovedEntries(source.registrations);
      const entries = randomizedApprovedEntries.map((entry, index) => ({
        id: randomUUID(),
        tournamentId: fresh.id,
        registeredByUserId: entry.registeredByUserId,
        entryName: entry.entryName,
        entryLogoUrl: entry.entryLogoUrl,
        sortOrder: entry.sortOrder,
        status: 'APPROVED' as const,
        groupId: groupRows.length ? groupRows[index % groupRows.length].id : null,
      }));
      await tx.tournamentRegistration.createMany({ data: entries });
      const members = randomizedApprovedEntries.flatMap((entry, index) =>
        entry.members.map(member => ({
          registrationId: entries[index].id,
          userId: member.userId,
          tournamentId: fresh.id,
        })),
      );
      if (members.length > 0) await tx.tournamentRegistrationMember.createMany({ data: members });


      await tx.auditLog.create({ data: {
        actorUserId: userId,
        action: 'TOURNAMENT_DRAW_RESTART_WITH_TEAMS',
        targetType: 'Tournament', targetId: source.id,
        scopeType: 'TOURNAMENT', scopeId: source.id,
        beforeData: {
          oldTournamentId: source.id,
          oldTournamentCode: source.code,
          oldTournamentName: source.name,
          approvedRegistrations: source.registrations.length,
        },
        afterData: {
          newTournamentId: fresh.id,
          newTournamentCode: fresh.code,
          preservedPreviousTournament: true,
          carriedTeams: entries.length,
          groupCount,
          drawAlgorithm: 'CRYPTO_FISHER_YATES_BALANCED',
        },
      } });
      return {
        tournamentId: fresh.id,
        tournamentName: fresh.name,
        tournamentCode: fresh.code,
        carriedTeams: entries.length,
        groupCount,
        alreadyCreated: false,
      };
    }, { isolationLevel: 'Serializable', timeout: 60000 });

    return { success: true, data: {
      ...result,
      message: 'New draw created. All approved teams carried over and evenly distributed into editable groups. Previous tournament and all match history are preserved separately.',
    }, error: null };
  }
}
