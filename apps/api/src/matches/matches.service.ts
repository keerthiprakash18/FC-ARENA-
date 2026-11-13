import { loadTournamentFormatGuide } from '../tournaments/tournament-format-guide.js';
import { getUclReturnLegAccess } from '../results/ucl-ties.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  SetMatchReadyDto,
} from './dto/set-match-ready.dto.js';
import type { ProposeMatchTimeDto } from './dto/propose-match-time.dto.js';

import {
  MatchRealtimeService,
} from './match-realtime.service.js';

const MINIMUM_PROPOSAL_LEAD_MS = 10 * 60_000;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly realtime:
      MatchRealtimeService,
  ) {}

  async getMatch(
    userId: string,
    matchId: string,
  ) {
    const access =
      await this.getMatchAccess(
        userId,
        matchId,
      );

    const {
      match,
      admin,
      participantSide,
      isParticipant,
    } =
      access;

    const homeSource =
      match.fixture.previousFixtures.find(
        (
          fixture,
        ) =>
          fixture.nextSlot ===
          'HOME',
      );

    const awaySource =
      match.fixture.previousFixtures.find(
        (
          fixture,
        ) =>
          fixture.nextSlot ===
          'AWAY',
      );

    const estimatedDeadlineAt =
      match.fixture.scheduledAt
        ? new Date(
            match.fixture.scheduledAt.getTime() +
              match.tournament
                .matchDurationMinutes *
                60_000,
          )
        : null;

    return {
      success: true,

      data: {
        match: {
          id:
            match.id,

          matchCode:
            match.matchCode,

          status:
            match.status,

          isLeagueAdmin:
            Boolean(
              admin,
            ),

          isParticipant,

          participantSide,

          returnLeg: match.tournament.competitionFormat === 'UCL_CUP'
            ? await getUclReturnLegAccess(this.prisma, match.fixture)
            : null,

          readiness: {
            homeReadyAt:
              match.homeReadyAt,

            awayReadyAt:
              match.awayReadyAt,

            homeReady:
              Boolean(
                match.homeReadyAt,
              ),

            awayReady:
              Boolean(
                match.awayReadyAt,
              ),

            bothReady:
              Boolean(
                match.homeReadyAt &&
                match.awayReadyAt,
              ),
          },

          schedule: {
            scheduledAt:
              match.fixture.scheduledAt,

            estimatedDeadlineAt,

            matchDurationMinutes:
              match.tournament
                .matchDurationMinutes,
          },

          tournament: {
            id:
              match.tournament.id,

            name:
              match.tournament.name,

            mode:
              match.tournament.mode,

            format:
              match.tournament.format,
            competitionFormat: match.tournament.competitionFormat,
            formatGuide: await loadTournamentFormatGuide(this.prisma, match.tournament.id),
          },

          league:
            match.tournament.league,

          fixture: {
            id:
              match.fixture.id,

            fixtureCode:
              match.fixture.fixtureCode,

            roundName:
              match.fixture.roundName,

            roundNumber:
              match.fixture.roundNumber,

            matchday:
              match.fixture.matchday,

            scheduledAt:
              match.fixture.scheduledAt,

            venue:
              match.fixture.venue,

            status:
              match.fixture.status,

            home:
              this.mapEntry(
                match.fixture
                  .homeRegistration,
              ),

            away:
              this.mapEntry(
                match.fixture
                  .awayRegistration,
              ),

            homeSource:
              homeSource
                ? homeSource.fixtureCode
                : null,

            awaySource:
              awaySource
                ? awaySource.fixtureCode
                : null,
          },
        },
      },

      error: null,
    };
  }

  async setReady(
    userId: string,
    matchId: string,
    dto:
      SetMatchReadyDto,
  ) {
    const {
      match,
      admin,
      participantSide,
    } =
      await this.getMatchAccess(
        userId,
        matchId,
      );

    if (
      ![
        'UNSCHEDULED',
        'SCHEDULED',
      ].includes(
        match.status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_READY_LOCKED',
          message:
            'Ready status can only change before the match starts.',
        },
      });
    }

    if (
      !match.fixture
        .homeRegistration ||
      !match.fixture
        .awayRegistration
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_PARTICIPANTS_NOT_READY',
          message:
            'Both match participants must be resolved before Ready can be set.',
        },
      });
    }

    let side =
      participantSide;

    if (
      dto.side
    ) {
      if (
        !admin &&
        participantSide !==
          dto.side
      ) {
        throw new ForbiddenException({
          success: false,
          data: null,
          error: {
            code:
              'MATCH_READY_SIDE_FORBIDDEN',
            message:
              'Players may only change Ready for their own side.',
          },
        });
      }

      side =
        dto.side;
    }

    if (!side) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_READY_SIDE_REQUIRED',
          message:
            'Only a participant can mark Ready. League Admins must choose HOME or AWAY.',
        },
      });
    }

    const now =
      dto.ready
        ? new Date()
        : null;

    const updated =
      await this.prisma.match.update({
        where: {
          id:
            matchId,
        },

        data:
          side ===
          'HOME'
            ? {
                homeReadyAt:
                  now,
              }
            : {
                awayReadyAt:
                  now,
              },

        select: {
          id: true,
          homeReadyAt: true,
          awayReadyAt: true,
        },
      });

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          userId,

        action:
          dto.ready
            ? 'MATCH_SIDE_READY'
            : 'MATCH_SIDE_NOT_READY',

        targetType:
          'Match',

        targetId:
          matchId,

        scopeType:
          'LEAGUE',

        scopeId:
          match.tournament
            .leagueId,

        metadata: {
          side,
        },
      },
    });

    this.realtime.publish(
      matchId,
      'ready_changed',
      {
        side,
        ready:
          dto.ready,
        homeReady:
          Boolean(
            updated.homeReadyAt,
          ),
        awayReady:
          Boolean(
            updated.awayReadyAt,
          ),
      },
    );

    return {
      success: true,

      data: {
        message:
          dto.ready
            ? `${side} side is Ready to Play.`
            : `${side} side Ready status was cleared.`,

        readiness: {
          homeReadyAt:
            updated.homeReadyAt,

          awayReadyAt:
            updated.awayReadyAt,

          homeReady:
            Boolean(
              updated.homeReadyAt,
            ),

          awayReady:
            Boolean(
              updated.awayReadyAt,
            ),

          bothReady:
            Boolean(
              updated.homeReadyAt &&
              updated.awayReadyAt,
            ),
        },
      },

      error: null,
    };
  }

  async assertRealtimeAccess(
    userId: string,
    matchId: string,
  ) {
    // A stream rechecks scope frequently; fetching all rosters/results is not
    // necessary to decide whether this league member still has access.
    const match = await this.prisma.match.findUnique({ where: { id: matchId },
      select: { tournament: { select: { leagueId: true } } } });
    if (!match) throw new NotFoundException({ success: false, data: null, error: {
      code: 'MATCH_NOT_FOUND', message: 'Match could not be found.',
    } });
    const member = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: match.tournament.leagueId, userId } }, select: { id: true },
    });
    if (!member) throw new ForbiddenException({ success: false, data: null, error: {
      code: 'LEAGUE_MEMBERSHIP_REQUIRED', message: 'You must be a League member to access this Match Room.',
    } });
  }

  /**
   * Advisory participant-coordinated times. These NEVER mutate the official
   * fixture schedule or match status; an authorized admin must schedule it.
   */
  async getTimeProposals(userId: string, matchId: string) {
    const access = await this.getMatchAccess(userId, matchId);
    if (!access.participantSide && !access.admin) {
      throw new ForbiddenException('Match participants or league admins only.');
    }
    if (process.env.MATCH_TIME_PROPOSALS_ENABLED !== 'true') {
      return { success: true, data: { enabled: false, proposals: [] }, error: null };
    }

    const proposals = await this.prisma.matchTimeProposal.findMany({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        proposedByUserId: true,
        proposedSide: true,
        startsAt: true,
        note: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
      },
    });
    const acceptanceCutoff = Date.now() + MINIMUM_PROPOSAL_LEAD_MS;
    return {
      success: true,
      data: {
        enabled: true,
        officialScheduledAt: access.match.fixture.scheduledAt,
        proposals: proposals.map(proposal => {
          const expired = proposal.status === 'PENDING' && proposal.startsAt.getTime() <= acceptanceCutoff;
          const actionable = proposal.status === 'PENDING' && !expired;
          return {
            id: proposal.id,
            proposedSide: proposal.proposedSide,
            startsAt: proposal.startsAt,
            note: proposal.note,
            status: expired ? 'EXPIRED' : proposal.status,
            createdAt: proposal.createdAt,
            confirmedAt: proposal.confirmedAt,
            canAccept: actionable && !!access.participantSide && access.participantSide !== proposal.proposedSide,
            canCancel: actionable && proposal.proposedByUserId === userId,
          };
        }),
      },
      error: null,
    };
  }

  async proposeMatchTime(userId: string, matchId: string, dto: ProposeMatchTimeDto) {
    this.assertTimeCoordinationEnabled();
    const access = await this.getMatchAccess(userId, matchId);
    const side = access.participantSide;
    if (!side) {
      throw new ForbiddenException('Only match participants can propose a time.');
    }
    this.assertMatchCanCoordinate(access.match);
    const startsAt = new Date(dto.startsAt);
    const record = await this.prisma.$transactionWithRetry(async tx => {
      const now = Date.now();
      const advanceMs = startsAt.getTime() - now;
      if (!Number.isFinite(advanceMs) || advanceMs <= MINIMUM_PROPOSAL_LEAD_MS || advanceMs > 14 * 24 * 3600_000) {
        throw new BadRequestException('Proposed time must be 10 minutes to 14 days from now.');
      }
      const pending = await tx.matchTimeProposal.count({
        where: {
          matchId,
          proposedByUserId: userId,
          status: 'PENDING',
          startsAt: { gt: new Date(now + MINIMUM_PROPOSAL_LEAD_MS) },
        },
      });
      if (pending >= 3) {
        throw new ConflictException('Cancel an existing pending time before proposing another.');
      }
      const lastHour = await tx.matchTimeProposal.count({
        where: { proposedByUserId: userId, createdAt: { gte: new Date(now - 60 * 60_000) } },
      });
      if (lastHour >= 10) {
        throw new ConflictException('Too many time proposals. Try again later.');
      }
      const created = await tx.matchTimeProposal.create({
        data: {
          matchId,
          proposedByUserId: userId,
          proposedSide: side,
          startsAt,
          note: dto.note?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'MATCH_TIME_PROPOSED',
          targetType: 'Match',
          targetId: matchId,
          scopeType: 'LEAGUE',
          scopeId: access.match.tournament.leagueId,
          metadata: { proposalId: created.id, proposedSide: side, startsAt: startsAt.toISOString() },
        },
      });
      return created;
    }, { isolationLevel: 'Serializable' });
    return {
      success: true,
      data: { proposalId: record.id, status: 'PENDING', officialScheduleUnchanged: true },
      error: null,
    };
  }

  async acceptMatchTime(userId: string, matchId: string, proposalId: string) {
    this.assertTimeCoordinationEnabled();
    const access = await this.getMatchAccess(userId, matchId);
    const side = access.participantSide;
    if (!side) throw new ForbiddenException('Only the opposing match participant can accept.');
    this.assertMatchCanCoordinate(access.match);
    const proposal = await this.prisma.matchTimeProposal.findFirst({
      where: { id: proposalId, matchId },
    });
    if (!proposal) throw new NotFoundException('Time proposal not found.');
    if (proposal.proposedSide === side) {
      throw new ForbiddenException('Your side cannot accept its own time proposal.');
    }
    if (proposal.startsAt.getTime() <= Date.now() + MINIMUM_PROPOSAL_LEAD_MS) {
      throw new ConflictException('This proposed time has expired. Request another slot.');
    }
    const result = await this.prisma.$transaction(async tx => {
      const changed = await tx.matchTimeProposal.updateMany({
        where: {
          id: proposalId, matchId, status: 'PENDING', proposedSide: { not: side },
          startsAt: { gt: new Date(Date.now() + MINIMUM_PROPOSAL_LEAD_MS) },
        },
        data: {
          status: 'ACCEPTED',
          confirmedByUserId: userId,
          confirmedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new ConflictException('Time proposal is no longer pending.');
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'MATCH_TIME_ACCEPTED',
          targetType: 'Match',
          targetId: matchId,
          scopeType: 'LEAGUE',
          scopeId: access.match.tournament.leagueId,
          metadata: { proposalId, acceptedBySide: side },
        },
      });
      return changed;
    });
    return {
      success: true,
      data: {
        accepted: result.count === 1,
        officialScheduleUnchanged: true,
        message: 'Both sides agreed. Ask an authorized admin to update the official fixture schedule.',
      },
      error: null,
    };
  }

  async cancelMatchTime(userId: string, matchId: string, proposalId: string) {
    this.assertTimeCoordinationEnabled();
    const access = await this.getMatchAccess(userId, matchId);
    if (!access.participantSide) {
      throw new ForbiddenException('Only the proposing participant may cancel a time.');
    }
    const changed = await this.prisma.$transaction(async tx => {
      const result = await tx.matchTimeProposal.updateMany({
        where: { id: proposalId, matchId, proposedByUserId: userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (result.count !== 1) throw new ConflictException('Proposal is not pending or not yours.');
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'MATCH_TIME_CANCELLED',
          targetType: 'Match',
          targetId: matchId,
          scopeType: 'LEAGUE',
          scopeId: access.match.tournament.leagueId,
          metadata: { proposalId },
        },
      });
      return result;
    });
    return { success: true, data: { cancelled: changed.count === 1 }, error: null };
  }

  private assertTimeCoordinationEnabled() {
    if (process.env.MATCH_TIME_PROPOSALS_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Match time coordination is not enabled.');
    }
  }

  private assertMatchCanCoordinate(match: {
    status: string;
    confirmedResultSubmissionId: string | null;
    fixture: {
      homeRegistration: unknown | null;
      awayRegistration: unknown | null;
    };
  }) {
    if (
      !['UNSCHEDULED', 'SCHEDULED', 'POSTPONED'].includes(match.status) ||
      match.confirmedResultSubmissionId ||
      !match.fixture.homeRegistration ||
      !match.fixture.awayRegistration
    ) {
      throw new ConflictException('Time coordination is locked for this match.');
    }
  }

  private async getMatchAccess(
    userId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id:
            matchId,
        },

        include: {
          tournament: {
            include: {
              league: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },

          fixture: {
            include: {
              homeRegistration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          fullName: true,

                          player: {
                            select: {
                              playerCode: true,

                              identity: {
                                select: {
                                  inGameName: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },

              awayRegistration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          fullName: true,

                          player: {
                            select: {
                              playerCode: true,

                              identity: {
                                select: {
                                  inGameName: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },

              previousFixtures: {
                select: {
                  fixtureCode: true,
                  nextSlot: true,
                },
              },
            },
          },
        },
      });

    if (!match) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_NOT_FOUND',

          message:
            'Match could not be found.',
        },
      });
    }

    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament
                .leagueId,

            userId,
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_MEMBERSHIP_REQUIRED',

          message:
            'You must be a League member to access this Match Room.',
        },
      });
    }

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament
                .leagueId,

            userId,
          },
        },
      });

    const homeUserIds =
      match.fixture
        .homeRegistration
        ?.members.map(
          (
            member,
          ) =>
            member.user.id,
        ) ??
      [];

    const awayUserIds =
      match.fixture
        .awayRegistration
        ?.members.map(
          (
            member,
          ) =>
            member.user.id,
        ) ??
      [];

    const participantSide:
      | 'HOME'
      | 'AWAY'
      | null =
      homeUserIds.includes(
        userId,
      )
        ? 'HOME'
        : awayUserIds.includes(
              userId,
            )
          ? 'AWAY'
          : null;

    return {
      match,
      admin,
      participantSide,
      isParticipant:
        participantSide !==
        null,
    };
  }

  private mapEntry(
    registration:
      any,
  ) {
    if (!registration) {
      return null;
    }

    return {
      id:
        registration.id,

      entryName:
        registration.entryName,

      members:
        registration.members.map(
          (
            member:
              any,
          ) => ({
            id:
              member.user.id,

            fullName:
              member.user.fullName,

            playerCode:
              member.user.player
                ?.playerCode ??
              null,

            inGameName:
              member.user.player
                ?.identity
                ?.inGameName ??
              null,
          }),
        ),
    };
  }
}
