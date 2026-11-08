import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../security/authorization.service.js';

/**
 * Destructive fixture reset is deliberately fail-closed.
 * Registrations, group assignments and the tournament record are retained.
 * Any recorded match activity requires an archival/recovery workflow instead.
 */
@Injectable()
export class TournamentFixtureResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

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
          _count: { select: {
            resultSubmissions: true, ocrExtractions: true,
            statEvents: true, disputes: true,
          } },
        } },
        deadlineCase: { select: { id: true } },
      },
    });

    const active = fixtures.some(f =>
      ['LIVE', 'COMPLETED'].includes(f.status) ||
      (f.match && (
        ['LIVE', 'COMPLETED'].includes(f.match.status) ||
        !!f.match.homeReadyAt || !!f.match.awayReadyAt ||
        !!f.match.confirmedResultSubmissionId ||
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
    const result = await this.prisma.$transaction(async tx => {
      const state = await this.inspectTx(tx, tournamentId);
      if (confirmation.trim() !== state.tournament.name) {
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
