import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { SafetyService } from '../security/safety.service.js';
import { cosmeticSelection } from './daily-reward-policy.js';
import {
  PLAYER_FRAMES,
  summarizeExperience,
  type ExperienceWeek,
  type PlayerFrame,
} from './experience-policy.js';

@Injectable()
export class ExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
  ) {}

  private async summary(userId: string, db: Prisma.TransactionClient) {
    // Use the participant snapshot of the current canonical result. Old submissions,
    // duplicate uploads and reversed matches cannot generate extra XP. The first
    // APPLY timestamp keeps corrections from moving old matches into a new week.
    const weeks = await db.$queryRaw<ExperienceWeek[]>(Prisma.sql`
      WITH verified AS (
        SELECT m.id,
          (SELECT MIN(first_event."createdAt") FROM match_result_stat_events first_event
           WHERE first_event."matchId" = m.id AND first_event.type = 'APPLY') AS occurred_at,
          t.mode
        FROM match_result_stat_events current_event
        JOIN matches m ON m."confirmedResultSubmissionId" = current_event."resultSubmissionId"
          AND m.id = current_event."matchId"
        JOIN result_submissions result ON result.id = m."confirmedResultSubmissionId" AND result."matchId" = m.id
        JOIN fixtures fixture ON fixture.id = m."fixtureId" AND fixture.status = 'COMPLETED'
        JOIN tournaments t ON t.id = m."tournamentId"
        WHERE current_event.type = 'APPLY' AND m.status = 'COMPLETED' AND result.status = 'CONFIRMED'
          AND ((current_event.payload #> '{home,userIds}') @> jsonb_build_array(${userId}::text)
            OR (current_event.payload #> '{away,userIds}') @> jsonb_build_array(${userId}::text))
      )
      SELECT to_char(date_trunc('week', occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS week,
        COUNT(DISTINCT id)::integer AS matches,
        COUNT(DISTINCT (occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)::integer AS days,
        COUNT(DISTINCT id) FILTER (WHERE mode IN ('DUO', 'TEAM'))::integer AS "teamMatches"
      FROM verified GROUP BY 1 ORDER BY 1 DESC
    `);
    const [completedTournaments, hasTeam, preferences] = await Promise.all([
      db.achievement.count({
        where: {
          userId,
          type: 'TOURNAMENT_PARTICIPATION',
          tournament: {
            status: 'COMPLETED',
            matches: {
              none: {
                OR: [
                  { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
                  {
                    status: 'COMPLETED',
                    OR: [
                      { confirmedResultSubmissionId: null },
                      { fixture: { status: { not: 'COMPLETED' } } },
                      { confirmedResult: { status: { not: 'CONFIRMED' } } },
                    ],
                  },
                ],
              },
            },
          },
        },
      }),
      db.tournamentRegistrationMember.count({
        where: {
          userId,
          registration: { status: 'APPROVED' },
          tournament: {
            mode: { in: ['DUO', 'TEAM'] },
            status: { not: 'CANCELLED' },
          },
        },
      }),
      db.playerExperiencePreferences.findUnique({ where: { userId } }),
    ]);
    const wallet = await db.playerRewardWallet.findUnique({where:{userId},select:{background:true,badge:true}});
    return { ...summarizeExperience(
      weeks,
      completedTournaments,
      hasTeam > 0,
      preferences?.frame,
    ), cosmetics: cosmeticSelection(wallet?.background,wallet?.badge) };
  }

  async getMine(userId: string) {
    const data = await this.prisma.$transaction(
      (db) => this.summary(userId, db),
      { isolationLevel: 'RepeatableRead' },
    );
    return { success: true, data, error: null };
  }

  async publicSummary(viewerId: string, userId: string) {
    if (await this.safety.isInteractionBlocked(viewerId, userId))
      throw new NotFoundException('Player could not be found.');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Player could not be found.');
    const summary = await this.prisma.$transaction(
      (db) => this.summary(userId, db),
      { isolationLevel: 'RepeatableRead' },
    );
    const {
      level,
      title,
      totalXp,
      frame,
      levelProgress,
      nextLevelXp,
      xpToNextLevel,
      verifiedMatches,
      completedTournaments,
      cosmetics,
    } = summary;
    return {
      success: true,
      data: {
        level,
        title,
        totalXp,
        frame,
        levelProgress,
        nextLevelXp,
        xpToNextLevel,
        verifiedMatches,
        completedTournaments,
        cosmetics,
      },
      error: null,
    };
  }

  async selectFrame(userId: string, frame: PlayerFrame) {
    const choice = PLAYER_FRAMES.find((item) => item.id === frame);
    if (!choice) throw new BadRequestException('Choose a valid player frame.');
    await this.prisma.$transactionWithRetry(
      async (db) => {
        const summary = await this.summary(userId, db);
        if (summary.level < choice.level)
          throw new ForbiddenException(
            `This frame unlocks at Level ${choice.level}.`,
          );
        await db.playerExperiencePreferences.upsert({
          where: { userId },
          create: { userId, frame },
          update: { frame },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.getMine(userId);
  }
}
