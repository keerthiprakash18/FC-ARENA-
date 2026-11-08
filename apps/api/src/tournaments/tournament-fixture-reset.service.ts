import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../security/authorization.service.js';

/**
 * Destructive fixture reset is deliberately fail-closed.
 * Fixture-only reset retains groups. Full draw reset clears groups but retains registrations.
 * Any recorded match activity requires an archival/recovery workflow instead.
 */
@Injectable()
export class TournamentFixtureResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private async lockDraw(tx: Prisma.TransactionClient, tournamentId: string) {
    await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM fixtures WHERE "tournamentId" = ${tournamentId}::uuid ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM matches WHERE "tournamentId" = ${tournamentId}::uuid ORDER BY id FOR UPDATE`;
  }

  private async inspectTx(tx: Prisma.TransactionClient, tournamentId: string) {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true, name: true, status: true, wizardStep: true,
        fixturesGeneratedAt: true, fixturesPublishedAt: true,
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const fixtures = await tx.fixture.findMany({
      where: { tournamentId },
      select: {
        id: true, status: true, scheduledAt: true, publishedAt: true,
        match: { select: {
          id: true, status: true, homeReadyAt: true, awayReadyAt: true,
          confirmedResultSubmissionId: true,
          arenaPost: { select: { id: true } },
          _count: { select: {
            resultSubmissions: true, ocrExtractions: true,
            statEvents: true, disputes: true,
          } },
        } },
        deadlineCase: { select: { id: true } },
      },
    });

    const active = fixtures.some(f =>
      !!f.deadlineCase || ['LIVE', 'COMPLETED'].includes(f.status) ||
      (f.match && (
        ['LIVE', 'COMPLETED'].includes(f.match.status) ||
        !!f.match.homeReadyAt || !!f.match.awayReadyAt ||
        !!f.match.confirmedResultSubmissionId ||
        !!f.match.arenaPost ||
        Object.values(f.match._count).some(value => Number(value) > 0)
      ))
    );

    // Independent tournament-level evidence also blocks resetting even if
    // a record has been detached from an original fixture.
    const [stats, standings, achievements, summary, resultEvents] = await Promise.all([
      tx.playerTournamentStatistic.count({
        where: { tournamentId, matches: { gt: 0 } },
      }),
      tx.tournamentStanding.count({
        where: { tournamentId, played: { gt: 0 } },
      }),
      tx.achievement.count({ where: { tournamentId } }),
      tx.tournamentSummary.count({ where: { tournamentId } }),
      tx.matchResultStatEvent.count({ where: { tournamentId } }),
    ]);

    const hasProgress = active || stats > 0 || standings > 0 ||
      achievements > 0 || summary > 0 || resultEvents > 0;
    const lockedByStatus = ['COMPLETED', 'CANCELLED'].includes(tournament.status);
    return {
      tournament,
      fixtureCount: fixtures.length,
      matchCount: fixtures.filter(f => !!f.match).length,
      scheduledCount: fixtures.filter(f => !!f.scheduledAt || f.status === 'SCHEDULED').length,
      deadlineCaseCount: fixtures.filter(f => !!f.deadlineCase).length,
      allowed: !hasProgress && !lockedByStatus,
      blocker: lockedByStatus
        ? 'Completed or cancelled tournaments cannot reset fixtures.'
        : hasProgress
          ? 'Recorded results, player activity, disputes, statistics or awards exist. Reset blocked to protect competition history.'
          : null,
    };
  }

  /**
   * Reset the ENTIRE group draw, not only the generated fixtures.
   * Keeps the approved team registrations, tournament and league identity.
   * This does not silently destroy verified results or player history.
   */
  async previewFullDraw(userId: string, tournamentId: string) {
    await this.authorization.assertCanManageFixtures(userId, tournamentId);
    await this.authorization.assertCanManageTournamentPermission(
      userId, tournamentId, 'MANAGE_PARTICIPANTS',
    );
    const state = await this.prisma.$transactionWithRetry(async tx => {
      const inspected = await this.inspectTx(tx, tournamentId);
      const [groupCount, approvedTeams, assignedTeams] = await Promise.all([
        tx.tournamentGroup.count({ where: { tournamentId } }),
        tx.tournamentRegistration.count({ where: { tournamentId, status: 'APPROVED' } }),
        tx.tournamentRegistration.count({ where: { tournamentId, status: 'APPROVED', groupId: { not: null } } }),
      ]);
      return { ...inspected, groupCount, approvedTeams, assignedTeams };
    }, { isolationLevel: 'Serializable', timeout: 30000 });

    return { success: true, data: {
      tournamentName: state.tournament.name,
      allowed: state.allowed, blocker: state.blocker,
      groupCount: state.groupCount, approvedTeams: state.approvedTeams,
      assignedTeams: state.assignedTeams,
      fixtureCount: state.fixtureCount, matchCount: state.matchCount,
      scheduledCount: state.scheduledCount,
      preserves: ['tournament', 'approved team registrations', 'players', 'league'],
      resets: ['all group names', 'all group assignments', 'fixtures', 'schedules', 'brackets', 'wizard progress'],
    }, error: null };
  }

  async resetFullDraw(
    userId: string, tournamentId: string, confirmation: string | undefined,
  ) {
    await this.authorization.assertCanManageFixtures(userId, tournamentId);
    await this.authorization.assertCanManageTournamentPermission(
      userId, tournamentId, 'MANAGE_PARTICIPANTS',
    );
    if (typeof confirmation !== 'string' || !confirmation.trim()) {
      throw new BadRequestException('Type the tournament name to confirm a full draw reset.');
    }
    const result = await this.prisma.$transactionWithRetry(async tx => {
      await this.lockDraw(tx, tournamentId);
      const state = await this.inspectTx(tx, tournamentId);
      if (confirmation !== state.tournament.name) {
        throw new BadRequestException('Tournament name confirmation does not match exactly.');
      }
      if (!state.allowed) {
        throw new ConflictException(state.blocker);
      }
      const [groups, approvedTeams] = await Promise.all([
        tx.tournamentGroup.count({ where: { tournamentId } }),
        tx.tournamentRegistration.count({ where: { tournamentId, status: 'APPROVED' } }),
      ]);
      await tx.auditLog.create({ data: {
        actorUserId: userId,
        action: 'TOURNAMENT_FULL_DRAW_RESET',
        targetType: 'Tournament',
        targetId: tournamentId,
        scopeType: 'TOURNAMENT',
        scopeId: tournamentId,
        beforeData: {
          fixtures: state.fixtureCount, matches: state.matchCount,
          groups, approvedTeams, status: state.tournament.status,
        },
        afterData: { fixtures: 0, matches: 0, groups: 0, approvedTeams },
        metadata: { scheduledCount: state.scheduledCount, confirmation: 'EXACT_TOURNAMENT_NAME' },
      } });

      // Clear bracket pointers to avoid self-reference constraints, then delete
      // all fixtures and their never-played matches in the same transaction.
      await tx.fixture.updateMany({
        where: { tournamentId },
        data: {
          nextFixtureId: null, nextSlot: null,
          loserNextFixtureId: null, loserNextSlot: null,
        },
      });
      await tx.fixture.deleteMany({ where: { tournamentId } });

      // Group FK on registrations is nullable: preserve registrations first.
      await tx.tournamentRegistration.updateMany({
        where: { tournamentId },
        data: { groupId: null },
      });
      await tx.tournamentGroup.deleteMany({ where: { tournamentId } });

      // No played scores/statistics are permitted above. Clear zero-game
      // standings to avoid carrying a previous draw into a new competition.
      await tx.tournamentStanding.deleteMany({ where: { tournamentId } });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          status: state.tournament.status === 'ACTIVE'
            ? 'REGISTRATION_CLOSED' : state.tournament.status,
          fixturesGeneratedAt: null,
          fixturesPublishedAt: null,
          qualifiersPerGroup: null,
          playoffQualifiersTotal: null,
          wizardStep: 'GROUPS',
        },
      });
      return {
        deletedFixtures: state.fixtureCount,
        deletedMatches: state.matchCount,
        deletedGroups: groups,
        keptApprovedTeams: approvedTeams,
      };
    }, { isolationLevel: 'Serializable', timeout: 60000 });
    return { success: true, data: {
      ...result,
      message: 'Full draw reset complete. All fixtures, schedules, groups and assignments were cleared. Your teams are still registered. Start again at Group Setup.',
    }, error: null };
  }

  async preview(userId: string, tournamentId: string) {
    await this.authorization.assertCanManageFixtures(userId, tournamentId);
    const state = await this.prisma.$transaction(
      tx => this.inspectTx(tx, tournamentId),
      { isolationLevel: 'Serializable', timeout: 30000 },
    );
    return { success: true, data: {
      tournamentName: state.tournament.name,
      fixtureCount: state.fixtureCount,
      matchCount: state.matchCount,
      scheduledCount: state.scheduledCount,
      allowed: state.allowed,
      blocker: state.blocker,
      preserves: ['tournament', 'registrations', 'groups', 'group assignments'],
    }, error: null };
  }

  async reset(userId: string, tournamentId: string, confirmation: string | undefined) {
    await this.authorization.assertCanManageFixtures(userId, tournamentId);
    if (typeof confirmation !== 'string' || !confirmation.trim()) {
      throw new BadRequestException('Type the exact tournament name to confirm fixture reset.');
    }
    const result = await this.prisma.$transactionWithRetry(async tx => {
      await this.lockDraw(tx, tournamentId);
      const state = await this.inspectTx(tx, tournamentId);
      if (confirmation !== state.tournament.name) {
        throw new BadRequestException('Tournament name confirmation does not match.');
      }
      if (!state.allowed) throw new ConflictException(state.blocker);
      if (!state.fixtureCount && !state.tournament.fixturesGeneratedAt) {
        return { deletedFixtures: 0, deletedMatches: 0, alreadyEmpty: true };
      }

      // Audit before cascading deletion. Never wipe groups or approved entries.
      await tx.auditLog.create({ data: {
        actorUserId: userId,
        action: 'TOURNAMENT_FIXTURES_RESET',
        targetType: 'Tournament',
        targetId: tournamentId,
        scopeType: 'TOURNAMENT',
        scopeId: tournamentId,
        beforeData: { fixtureCount: state.fixtureCount, matchCount: state.matchCount },
        afterData: { fixtureCount: 0, matchCount: 0 },
        metadata: { scheduledCount: state.scheduledCount, confirmation: 'EXACT_TOURNAMENT_NAME' },
      } });
      // FK self-references on next/loser fixture are made null before deletion.
      await tx.fixture.updateMany({
        where: { tournamentId },
        data: { nextFixtureId: null, nextSlot: null, loserNextFixtureId: null, loserNextSlot: null },
      });
      await tx.fixture.deleteMany({ where: { tournamentId } });
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          fixturesGeneratedAt: null, fixturesPublishedAt: null,
          wizardStep: 'GROUPS',
        },
      });
      return {
        deletedFixtures: state.fixtureCount,
        deletedMatches: state.matchCount,
        alreadyEmpty: false,
      };
    }, { isolationLevel: 'Serializable', timeout: 60000 });
    return { success: true, data: {
      ...result,
      message: 'Fixtures reset. Teams, groups, registrations and tournament settings were preserved. Generate a new draw from the wizard.',
    }, error: null };
  }
}
