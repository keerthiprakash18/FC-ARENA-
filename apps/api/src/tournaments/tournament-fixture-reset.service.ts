import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';

export interface ResetSummary {
  tournamentId: string;
  tournamentName: string;
  tournamentCode: string;
  status: string;
  groupMode: string;
  fixtures: number;
  matches: number;
  scheduled: number;
  published: number;
  protectedMatches: number;
  protectedFixtures: number;
  standingsWithResults: number;
  achievements: number;
  summaryPublished: boolean;
  canReset: boolean;
  reason: string | null;
}

/**
 * Resets the entire draw, never the tournament or participant registrations.
 * Any submitted/played/disputed match is a hard stop: deletion would cascade
 * results, screenshots, standings, player statistics or award records.
 */
@Injectable()
export class TournamentFixtureResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private async authorize(userId: string, tournamentId: string) {
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_SETTINGS');
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_FIXTURES');
  }

  private async inspect(tournamentId: string, db: any): Promise<ResetSummary> {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, code: true, status: true, groupMode: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found.');

    const [
      fixtures, matches, scheduled, published, protectedMatches,
      protectedFixtures, standingsWithResults, achievements, summary,
    ] = await Promise.all([
      db.fixture.count({ where: { tournamentId } }),
      db.match.count({ where: { tournamentId } }),
      db.fixture.count({
        where: { tournamentId, OR: [
          { status: { in: ['SCHEDULED', 'POSTPONED'] } },
          { scheduledAt: { not: null } },
        ] },
      }),
      db.fixture.count({ where: { tournamentId, publishedAt: { not: null } } }),
      db.match.count({
        where: { tournamentId, OR: [
          { status: { in: ['LIVE', 'COMPLETED'] } },
          { homeReadyAt: { not: null } },
          { awayReadyAt: { not: null } },
          { confirmedResultSubmissionId: { not: null } },
          { resultSubmissions: { some: {} } },
          { ocrExtractions: { some: {} } },
          { disputes: { some: {} } },
          { statEvents: { some: {} } },
        ] },
      }),
      db.fixture.count({ where: { tournamentId, status: { in: ['LIVE', 'COMPLETED'] } } }),
      db.tournamentStanding.count({ where: { tournamentId, OR: [
        { played: { gt: 0 } }, { wins: { gt: 0 } },
        { draws: { gt: 0 } }, { losses: { gt: 0 } },
        { points: { not: 0 } },
      ] } }),
      db.achievement.count({ where: { tournamentId } }),
      db.tournamentSummary.findUnique({ where: { tournamentId }, select: { id: true } }),
    ]);

    let reason: string | null = null;
    if (['COMPLETED', 'CANCELLED'].includes(tournament.status)) {
      reason = 'Completed or cancelled tournaments cannot be reset.';
    } else if (tournament.status === 'REGISTRATION_OPEN') {
      reason = 'Close registration before resetting fixtures.';
    } else if (
      protectedMatches > 0 || protectedFixtures > 0 ||
      standingsWithResults > 0 || achievements > 0 || summary
    ) {
      reason = 'Some matches already contain activity, scores, disputes or awards. Reset is blocked to protect official results. Archive and resolve these records before changing the draw.';
    }

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentCode: tournament.code,
      status: tournament.status,
      groupMode: tournament.groupMode,
      fixtures,
      matches,
      scheduled,
      published,
      protectedMatches,
      protectedFixtures,
      standingsWithResults,
      achievements,
      summaryPublished: Boolean(summary),
      canReset: fixtures > 0 && !reason,
      reason,
    };
  }

  async impact(userId: string, tournamentId: string) {
    await this.authorize(userId, tournamentId);
    const impact = await this.inspect(tournamentId, this.prisma);
    return { success: true, data: impact, error: null };
  }

  async reset(userId: string, tournamentId: string, confirmation: string) {
    await this.authorize(userId, tournamentId);
    if (!confirmation || typeof confirmation !== 'string' || confirmation.length > 100) {
      throw new BadRequestException({
        success: false, data: null,
        error: { code: 'FIXTURE_RESET_CONFIRMATION_REQUIRED', message: 'Enter the exact confirmation phrase shown in Settings.' },
      });
    }

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      // Serialize resets for this tournament with other reset requests.
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;

      const impact = await this.inspect(tournamentId, tx);
      if (!impact.canReset) {
        throw new ConflictException({
          success: false, data: impact,
          error: { code: 'FIXTURE_RESET_UNSAFE', message: impact.reason ?? 'There are no fixtures to reset.' },
        });
      }
      if (confirmation !== `RESET ${impact.tournamentCode}`) {
        throw new BadRequestException({
          success: false, data: null,
          error: { code: 'FIXTURE_RESET_CONFIRMATION_MISMATCH', message: 'Confirmation must match the exact tournament code.' },
        });
      }

      // Match, deadline-case and evidence relations cascade with fixture records.
      // This is safe only because no result, dispute, readiness or stats exist.
      const deleted = await tx.fixture.deleteMany({ where: { tournamentId } });
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          fixturesGeneratedAt: null,
          fixturesPublishedAt: null,
          ...(impact.status === 'ACTIVE' ? { status: 'REGISTRATION_CLOSED' as const } : {}),
          wizardStep: impact.groupMode === 'MULTIPLE_GROUPS' ? 'GROUPS' : 'FIXTURE_SETTINGS',
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'TOURNAMENT_FIXTURES_RESET',
          targetType: 'Tournament',
          targetId: tournamentId,
          scopeType: 'TOURNAMENT',
          scopeId: tournamentId,
          beforeData: {
            fixtureCount: impact.fixtures,
            matchCount: impact.matches,
            scheduledCount: impact.scheduled,
            publishedCount: impact.published,
          },
          afterData: { fixtureCount: 0, fixtureGeneratedAt: null, wizardStep: impact.groupMode === 'MULTIPLE_GROUPS' ? 'GROUPS' : 'FIXTURE_SETTINGS' },
          metadata: { confirmation: 'CODE_VERIFIED', preservedRegistrations: true, preservedGroups: true },
        },
      });

      return { deleted: deleted.count, nextStep: impact.groupMode === 'MULTIPLE_GROUPS' ? 'GROUPS' : 'FIXTURE_SETTINGS' };
    });

    return {
      success: true,
      data: {
        message: 'All unplayed fixtures were removed. Teams and tournament groups are preserved. You can configure a new draw now.',
        ...result,
      },
      error: null,
    };
  }
}
