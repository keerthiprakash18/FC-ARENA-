import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  AiChatDto,
} from './dto/chat.dto.js';

const MINUTE_LIMIT = 10;
const DAILY_LIMIT = 30;
const REQUEST_TIMEOUT_MS = 10_000;

interface UsageBucket {
  minuteStartedAt: number;
  minuteCount: number;
  dayKey: string;
  dayCount: number;
}

interface ProviderChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class AiService {
  private readonly usage =
    new Map<string, UsageBucket>();

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  getStatus() {
    const configured =
      this.isConfigured();

    return {
      success: true,

      data: {
        enabled: true,
        configured,
        providerEnabled:
          this.isEnabled() &&
          configured,
        fallbackEnabled:
          true,
        mode:
          'READ_ONLY',
        limits: {
          perMinute:
            MINUTE_LIMIT,
          perDay:
            DAILY_LIMIT,
        },
      },

      error: null,
    };
  }

  async chat(
    userId: string,
    dto: AiChatDto,
  ) {
    this.consumeLimit(
      userId,
    );

    const context =
      await this.buildContext(
        userId,
      );

    let answer:
      string;

    let engine:
      'PROVIDER'
      | 'LOCAL_FALLBACK' =
      'LOCAL_FALLBACK';

    if (
      this.isEnabled() &&
      this.isConfigured()
    ) {
      try {
        answer =
          await this.requestProvider(
            dto,
            context,
          );

        engine =
          'PROVIDER';
      } catch {
        answer =
          this.localAnswer(
            dto.message,
            context,
          );
      }
    } else {
      answer =
        this.localAnswer(
          dto.message,
          context,
        );
    }

    return {
      success: true,

      data: {
        answer,
        generatedAt:
          new Date().toISOString(),
        mode:
          'READ_ONLY',
        engine,
      },

      error: null,
    };
  }

  private isEnabled(): boolean {
    return (
      process.env.AI_ASSISTANT_ENABLED
        ?.trim()
        .toLowerCase() ===
      'true'
    );
  }

  private isConfigured(): boolean {
    return Boolean(
      process.env.AI_PROVIDER_BASE_URL
        ?.trim() &&
        process.env.AI_PROVIDER_API_KEY
          ?.trim() &&
        process.env.AI_PROVIDER_MODEL
          ?.trim(),
    );
  }

  private consumeLimit(
    userId: string,
  ): void {
    const now =
      Date.now();

    const dayKey =
      new Date(now)
        .toISOString()
        .slice(
          0,
          10,
        );

    const existing =
      this.usage.get(
        userId,
      );

    const bucket:
      UsageBucket =
      existing ?? {
        minuteStartedAt:
          now,
        minuteCount:
          0,
        dayKey,
        dayCount:
          0,
      };

    if (
      now -
        bucket.minuteStartedAt >=
      60_000
    ) {
      bucket.minuteStartedAt =
        now;
      bucket.minuteCount =
        0;
    }

    if (
      bucket.dayKey !==
      dayKey
    ) {
      bucket.dayKey =
        dayKey;
      bucket.dayCount =
        0;
    }

    if (
      bucket.minuteCount >=
      MINUTE_LIMIT
    ) {
      throw new HttpException({
        success: false,
        data: null,
        error: {
          code:
            'AI_RATE_LIMIT_MINUTE',
          message:
            'Too many AI questions. Try again in a minute.',
        },
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      bucket.dayCount >=
      DAILY_LIMIT
    ) {
      throw new HttpException({
        success: false,
        data: null,
        error: {
          code:
            'AI_RATE_LIMIT_DAILY',
          message:
            'Your FC ARENA AI daily limit has been reached.',
        },
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.minuteCount += 1;
    bucket.dayCount += 1;

    this.usage.set(
      userId,
      bucket,
    );
  }

  private async buildContext(
    userId: string,
  ) {
    const now =
      new Date();

    const [
      user,
      memberships,
      entries,
      statistics,
      fixtures,
    ] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id:
              userId,
          },

          select: {
            fullName: true,

            player: {
              select: {
                playerCode:
                  true,

                identity: {
                  select: {
                    inGameName:
                      true,
                    isVerified:
                      true,
                  },
                },
              },
            },
          },
        }),

        this.prisma.leagueMember.findMany({
          where: {
            userId,
          },

          select: {
            type: true,

            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: {
            joinedAt:
              'asc',
          },
        }),

        this.prisma.tournamentRegistrationMember.findMany({
          where: {
            userId,
          },

          select: {
            createdAt: true,

            registration: {
              select: {
                entryName:
                  true,
                status:
                  true,
              },
            },

            tournament: {
              select: {
                id: true,
                name: true,
                status: true,
                competitionFormat:
                  true,

                league: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },

          orderBy: {
            createdAt:
              'desc',
          },

          take: 6,
        }),

        this.prisma.playerTournamentStatistic.findMany({
          where: {
            userId,
          },

          select: {
            matches: true,
            wins: true,
            draws: true,
            losses: true,
            goalsFor: true,
            goalsAgainst:
              true,
            goalDifference:
              true,
            form: true,
            updatedAt: true,

            tournament: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },

          orderBy: {
            updatedAt:
              'desc',
          },

          take: 6,
        }),

        this.prisma.fixture.findMany({
          where: {
            status: {
              notIn: [
                'COMPLETED',
                'CANCELLED',
              ],
            },

            AND: [
              {
                OR: [
                  {
                    scheduledAt: {
                      gte:
                        now,
                    },
                  },
                  {
                    scheduledAt:
                      null,
                  },
                ],
              },
              {
                OR: [
                  {
                    homeRegistration: {
                      is: {
                        members: {
                          some: {
                            userId,
                          },
                        },
                      },
                    },
                  },
                  {
                    awayRegistration: {
                      is: {
                        members: {
                          some: {
                            userId,
                          },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },

          select: {
            id: true,
            fixtureCode:
              true,
            roundName:
              true,
            matchday: true,
            scheduledAt:
              true,
            status: true,

            tournament: {
              select: {
                id: true,
                name: true,
              },
            },

            homeRegistration: {
              select: {
                entryName:
                  true,
              },
            },

            awayRegistration: {
              select: {
                entryName:
                  true,
              },
            },

            match: {
              select: {
                id: true,
                status: true,
              },
            },
          },

          orderBy: {
            updatedAt:
              'desc',
          },

          take: 10,
        }),
      ]);

    const sortedFixtures =
      fixtures
        .map((fixture) => ({
          id:
            fixture.id,
          fixtureCode:
            fixture.fixtureCode,
          tournamentId:
            fixture.tournament.id,
          tournament:
            fixture.tournament.name,
          roundName:
            fixture.roundName,
          matchday:
            fixture.matchday,
          scheduledAt:
            fixture.scheduledAt
              ?.toISOString() ??
            null,
          status:
            fixture.status,
          home:
            fixture.homeRegistration
              ?.entryName ??
            'TBD',
          away:
            fixture.awayRegistration
              ?.entryName ??
            'TBD',
          matchId:
            fixture.match?.id ??
            null,
          matchStatus:
            fixture.match?.status ??
            null,
        }))
        .sort((a, b) => {
          if (
            a.scheduledAt &&
            b.scheduledAt
          ) {
            return (
              new Date(
                a.scheduledAt,
              ).getTime() -
              new Date(
                b.scheduledAt,
              ).getTime()
            );
          }

          if (
            a.scheduledAt
          ) {
            return -1;
          }

          if (
            b.scheduledAt
          ) {
            return 1;
          }

          return 0;
        })
        .slice(
          0,
          5,
        );

    return {
      player: {
        name:
          user?.player
            ?.identity
            ?.inGameName ??
          user?.fullName ??
          'FC ARENA Player',
        playerCode:
          user?.player
            ?.playerCode ??
          null,
        verified:
          user?.player
            ?.identity
            ?.isVerified ??
          false,
      },

      leagues:
        memberships.map(
          (membership) => ({
            id:
              membership.league.id,
            name:
              membership.league.name,
            membershipType:
              membership.type,
          }),
        ),

      tournaments:
        entries.map(
          (entry) => ({
            id:
              entry.tournament.id,
            name:
              entry.tournament.name,
            status:
              entry.tournament.status,
            competitionFormat:
              entry.tournament
                .competitionFormat,
            league:
              entry.tournament.league
                .name,
            entryName:
              entry.registration
                .entryName,
            registrationStatus:
              entry.registration
                .status,
          }),
        ),

      recentStatistics:
        statistics.map(
          (stat) => ({
            tournament:
              stat.tournament.name,
            tournamentStatus:
              stat.tournament.status,
            matches:
              stat.matches,
            wins:
              stat.wins,
            draws:
              stat.draws,
            losses:
              stat.losses,
            goalsFor:
              stat.goalsFor,
            goalsAgainst:
              stat.goalsAgainst,
            goalDifference:
              stat.goalDifference,
            form:
              stat.form,
          }),
        ),

      upcomingFixtures:
        sortedFixtures,
    };
  }

  private localAnswer(
    rawMessage: string,
    context: {
      player: {
        name: string;
        playerCode: string | null;
        verified: boolean;
      };
      leagues: Array<{
        id: string;
        name: string;
        membershipType: string;
      }>;
      tournaments: Array<{
        id: string;
        name: string;
        status: string;
        competitionFormat: string;
        league: string;
        entryName: string | null;
        registrationStatus: string;
      }>;
      recentStatistics: Array<{
        tournament: string;
        tournamentStatus: string;
        matches: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        form: string;
      }>;
      upcomingFixtures: Array<{
        id: string;
        fixtureCode: string;
        tournamentId: string;
        tournament: string;
        roundName: string;
        matchday: number | null;
        scheduledAt: string | null;
        status: string;
        home: string;
        away: string;
        matchId: string | null;
        matchStatus: string | null;
      }>;
    },
  ): string {
    const message =
      rawMessage
        .trim()
        .toLowerCase();

    const includesAny = (
      words: string[],
    ) =>
      words.some(
        (word) =>
          message.includes(
            word,
          ),
      );

    if (
      includesAny([
        'next match',
        'upcoming match',
        'next fixture',
        'fixture',
        'அடுத்த மேட்ச்',
        'அடுத்த match',
      ])
    ) {
      const fixture =
        context.upcomingFixtures[0];

      if (!fixture) {
        return 'I cannot find an upcoming fixture for you right now. Open Fixtures to check newly generated or unscheduled matches.';
      }

      const schedule =
        fixture.scheduledAt
          ? new Date(
              fixture.scheduledAt,
            ).toLocaleString(
              'en-IN',
              {
                dateStyle:
                  'medium',
                timeStyle:
                  'short',
              },
            )
          : 'Schedule pending';

      return `Your next recorded fixture is ${fixture.home} vs ${fixture.away} in ${fixture.tournament} · ${fixture.roundName}. ${schedule}. Open Fixtures for Match Center details.`;
    }

    if (
      includesAny([
        'league',
        'லீக்',
      ])
    ) {
      if (
        context.leagues.length ===
        0
      ) {
        return 'You are not currently linked to a League. Open League to join with a League Code or create a new League.';
      }

      const leagues =
        context.leagues
          .map(
            (league) =>
              `${league.name} (${league.membershipType})`,
          )
          .join(', ');

      return `Your current FC ARENA Leagues: ${leagues}. A player can belong to a maximum of two Leagues: Primary and Secondary.`;
    }

    if (
      includesAny([
        'tournament',
        'டோர்னமெண்ட்',
        'டூர்னமெண்ட்',
      ])
    ) {
      if (
        includesAny([
          'create',
          'setup',
          'how',
          'எப்படி',
        ])
      ) {
        return 'League admins can create a Tournament and complete it through Setup → Teams → Groups when required → Fixture Settings → Fixture Preview → Qualification when required → Review → Publish.';
      }

      if (
        context.tournaments.length ===
        0
      ) {
        return 'I cannot find a Tournament registration for you right now. Open Tournament to view competitions in your selected League.';
      }

      const recent =
        context.tournaments
          .slice(
            0,
            3,
          )
          .map(
            (tournament) =>
              `${tournament.name} (${tournament.status})`,
          )
          .join(', ');

      return `Your recent Tournament context: ${recent}.`;
    }

    if (
      includesAny([
        'stat',
        'record',
        'win',
        'loss',
        'goal',
        'form',
        'ஸ்டாட்',
      ])
    ) {
      if (
        context.recentStatistics.length ===
        0
      ) {
        return 'No verified Tournament statistics are available for your account yet. Stats are updated from confirmed Match Results.';
      }

      const totals =
        context.recentStatistics.reduce(
          (
            sum,
            stat,
          ) => ({
            matches:
              sum.matches +
              stat.matches,
            wins:
              sum.wins +
              stat.wins,
            draws:
              sum.draws +
              stat.draws,
            losses:
              sum.losses +
              stat.losses,
            goalsFor:
              sum.goalsFor +
              stat.goalsFor,
            goalsAgainst:
              sum.goalsAgainst +
              stat.goalsAgainst,
          }),
          {
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          },
        );

      return `Across your recent recorded Tournament stats: ${totals.matches} matches, ${totals.wins} wins, ${totals.draws} draws, ${totals.losses} losses, ${totals.goalsFor} goals for and ${totals.goalsAgainst} goals against. Open More → Career Stats for the full record.`;
    }

    if (
      includesAny([
        'result',
        'score',
        'ocr',
        'screenshot',
        'ரிசல்ட்',
      ])
    ) {
      return 'Open the relevant Match from Fixtures. A permitted participant or admin can submit the score manually or upload a result screenshot for OCR. Standings and player statistics update only after the normal admin verification flow.';
    }

    if (
      includesAny([
        'group',
        'குரூப்',
      ])
    ) {
      return 'Tournament groups are admin-controlled. Admins can create, rename and delete groups, move teams between groups, or use supported even/random distribution before generating group fixtures.';
    }

    if (
      includesAny([
        'poster',
        'போஸ்டர்',
      ])
    ) {
      return 'Open a Tournament and choose Auto Poster. FC ARENA can generate share graphics from real Fixture, Result, Standings and Champion data.';
    }

    if (
      includesAny([
        'role',
        'admin',
        'permission',
        'audit',
        'ரோல்',
      ])
    ) {
      return 'League admins can open League Settings → Roles & Audit to assign supported scoped roles and review recorded permission changes. Tournament Admin and Match Admin permissions are enforced by the backend.';
    }

    return `Hi ${context.player.name}. FC ARENA Assist is ready in read-only mode. I can explain app workflows and use your current League, Tournament, Fixture and verified statistics context. Try “What is my next match?”, “Show my stats”, “How do I submit a result?”, or “How do Auto Posters work?”`;
  }

  private async requestProvider(
    dto: AiChatDto,
    context: unknown,
  ): Promise<string> {
    const baseUrl =
      process.env.AI_PROVIDER_BASE_URL!
        .trim()
        .replace(
          /\/$/,
          '',
        );

    const apiKey =
      process.env.AI_PROVIDER_API_KEY!
        .trim();

    const model =
      process.env.AI_PROVIDER_MODEL!
        .trim();

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

    const systemPrompt =
      [
        'You are FC ARENA AI Assistant.',
        'You are strictly READ ONLY. Never claim to create, update, delete, approve, verify, schedule, submit, publish or otherwise change FC ARENA data.',
        'You may explain how the user can perform supported actions in the app.',
        'Use only the supplied FC ARENA context for personal match, league, tournament and statistics facts. If data is absent, say it is not currently available instead of guessing.',
        'Reply in the language/style used by the user when practical, including Tamil or Tanglish. Keep answers concise and useful.',
        'Core FC ARENA rules: a player can belong to at most two leagues (Primary and Secondary); tournament setup uses separate setup/teams/groups/fixture settings/preview/review steps; fixtures are previewed before save; confirmed results drive standings/statistics; OCR result submissions require the normal verification flow.',
        'Do not expose internal IDs unless they are directly useful for navigation or support.',
        'Current authenticated user context follows as JSON:',
        JSON.stringify(
          context,
        ),
      ].join(
        '\n',
      );

    try {
      const response =
        await fetch(
          `${baseUrl}/chat/completions`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
              Authorization:
                `Bearer ${apiKey}`,
            },

            body:
              JSON.stringify({
                model,
                messages: [
                  {
                    role:
                      'system',
                    content:
                      systemPrompt,
                  },
                  ...(dto.history ??
                    []).map(
                    (item) => ({
                      role:
                        item.role,
                      content:
                        item.content
                          .trim()
                          .slice(
                            0,
                            1000,
                          ),
                    }),
                  ),
                  {
                    role:
                      'user',
                    content:
                      dto.message
                        .trim(),
                  },
                ],
                max_tokens:
                  450,
              }),

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw new Error(
          'AI provider rejected the request.',
        );
      }

      const payload =
        (await response.json()) as
          ProviderChatResponse;

      const answer =
        payload.choices?.[0]
          ?.message?.content
          ?.trim();

      if (!answer) {
        throw new Error(
          'AI provider returned an empty response.',
        );
      }

      return answer;
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code:
            'AI_PROVIDER_UNAVAILABLE',
          message:
            'FC ARENA AI is temporarily unavailable. Please try again later.',
        },
      });
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }
}
