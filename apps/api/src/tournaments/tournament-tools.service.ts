import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  CloneTournamentDto,
  CreateTournamentFromTemplateDto,
  CreateTournamentTemplateDto,
} from './dto/create-tournament-template.dto.js';
import type { ReviewDeadlineCaseDto } from './dto/review-deadline-case.dto.js';
import { TournamentsService } from './tournaments.service.js';

type TemplateConfig = {
  mode: 'SOLO' | 'DUO' | 'TEAM';
  format: 'ROUND_ROBIN' | 'KNOCKOUT';
  competitionFormat?: string;
  groupMode?: string;
  legType?: string;
  fixtureMode?: string;
  visibility?: string;
  registrationMode?: string;
  teamSize: number;
  maxEntries: number;
  qualifiersPerGroup?: number | null;
  playoffPairingMethod?: string;
  dailyMatchLimit?: number;
  matchesPerParticipantPerDay?: number;
  matchDurationMinutes?: number;
  resultDeadlineHours?: number;
};

@Injectable()
export class TournamentToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationsService,
    private readonly tournaments: TournamentsService,
  ) {}

  async listTemplates(userId: string, leagueId: string) {
    await this.authorization.assertLeaguePermission(userId, leagueId, 'MANAGE_TOURNAMENTS');

    const templates = await this.prisma.tournamentTemplate.findMany({
      where: { leagueId },
      orderBy: { updatedAt: 'desc' },
    });

    return { success: true, data: { templates }, error: null };
  }

  async createTemplate(
    userId: string,
    leagueId: string,
    dto: CreateTournamentTemplateDto,
  ) {
    await this.authorization.assertLeaguePermission(userId, leagueId, 'MANAGE_TOURNAMENTS');

    let config = dto.config as TemplateConfig | undefined;
    if (dto.sourceTournamentId) {
      const source = await this.prisma.tournament.findFirst({
        where: { id: dto.sourceTournamentId, leagueId },
      });
      if (!source) throw this.notFound('Source tournament could not be found.');
      config = this.configFromTournament(source);
    }

    if (!config?.mode || !config.format || !config.teamSize || !config.maxEntries) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'TEMPLATE_CONFIG_REQUIRED',
          message: 'A source tournament or complete tournament configuration is required.',
        },
      });
    }

    const template = await this.prisma.tournamentTemplate.create({
      data: {
        leagueId,
        createdByUserId: userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        config: config as unknown as Prisma.InputJsonValue,
      },
    });

    return { success: true, data: { template }, error: null };
  }

  async createFromTemplate(
    userId: string,
    templateId: string,
    dto: CreateTournamentFromTemplateDto,
  ) {
    const template = await this.prisma.tournamentTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw this.notFound('Tournament template could not be found.');

    await this.authorization.assertLeaguePermission(userId, template.leagueId, 'MANAGE_TOURNAMENTS');
    const config = template.config as unknown as TemplateConfig;
    return this.createTournamentFromConfig(userId, template.leagueId, config, dto.name, dto);
  }

  async saveTournamentAsTemplate(
    userId: string,
    tournamentId: string,
    dto: CreateTournamentTemplateDto,
  ) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw this.notFound('Tournament could not be found.');
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_SETTINGS');

    return this.createTemplate(userId, tournament.leagueId, {
      name: dto.name,
      description: dto.description,
      config: dto.config,
      sourceTournamentId: tournamentId,
    });
  }

  async cloneTournament(userId: string, tournamentId: string, dto: CloneTournamentDto) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw this.notFound('Tournament could not be found.');
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_SETTINGS');
    return this.createTournamentFromConfig(
      userId,
      tournament.leagueId,
      this.configFromTournament(tournament),
      dto.name,
      dto,
    );
  }

  async getSeasonAnalytics(
    userId: string,
    leagueId: string,
    from?: string,
    to?: string,
  ) {
    await this.authorization.assertLeaguePermission(userId, leagueId, 'VIEW_REPORTS');
    const fromDate = from ? new Date(from) : new Date('1970-01-01T00:00:00.000Z');
    const toDate = to ? new Date(to) : new Date('2999-12-31T23:59:59.999Z');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      throw new BadRequestException('Analytics date range is invalid.');
    }

    const tournaments = await this.prisma.tournament.findMany({
      where: { leagueId, createdAt: { gte: fromDate, lte: toDate } },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            registrations: { where: { status: 'APPROVED' } },
            fixtures: true,
            achievements: true,
          },
        },
        fixtures: { select: { status: true } },
      },
    });

    const summary = tournaments.reduce(
      (result, tournament) => {
        result.tournaments += 1;
        result.approvedEntries += tournament._count.registrations;
        result.fixtures += tournament._count.fixtures;
        result.completedFixtures += tournament.fixtures.filter((fixture) => fixture.status === 'COMPLETED').length;
        result.awards += tournament._count.achievements;
        if (tournament.status === 'COMPLETED') result.completedTournaments += 1;
        return result;
      },
      { tournaments: 0, completedTournaments: 0, approvedEntries: 0, fixtures: 0, completedFixtures: 0, awards: 0 },
    );

    return {
      success: true,
      data: {
        range: { from: fromDate.toISOString(), to: toDate.toISOString() },
        summary,
        tournaments: tournaments.map((tournament) => ({
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          mode: tournament.mode,
          competitionFormat: tournament.competitionFormat,
          createdAt: tournament.createdAt,
          completedAt: tournament.completedAt,
          approvedEntries: tournament._count.registrations,
          fixtures: tournament._count.fixtures,
          completedFixtures: tournament.fixtures.filter((fixture) => fixture.status === 'COMPLETED').length,
          awards: tournament._count.achievements,
        })),
      },
      error: null,
    };
  }

  async exportTournament(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        fixtures: {
          orderBy: { sequence: 'asc' },
          include: {
            homeRegistration: { select: { entryName: true } },
            awayRegistration: { select: { entryName: true } },
            match: { include: { confirmedResult: { select: { homeScore: true, awayScore: true, reviewedAt: true } } } },
          },
        },
        achievements: {
          select: { type: true, title: true, user: { select: { fullName: true } } },
          orderBy: { awardedAt: 'asc' },
        },
      },
    });
    if (!tournament) throw this.notFound('Tournament could not be found.');
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'VIEW_REPORTS');

    const rows = [
      ['section', 'fixtureCode', 'round', 'home', 'away', 'homeScore', 'awayScore', 'verifiedAt'],
      ...tournament.fixtures.map((fixture) => [
        'result', fixture.fixtureCode, fixture.roundName, fixture.homeRegistration?.entryName ?? 'TBD',
        fixture.awayRegistration?.entryName ?? 'TBD',
        fixture.match?.confirmedResult?.homeScore?.toString() ?? '',
        fixture.match?.confirmedResult?.awayScore?.toString() ?? '',
        fixture.match?.confirmedResult?.reviewedAt?.toISOString() ?? '',
      ]),
      [],
      ['section', 'awardType', 'title', 'recipient'],
      ...tournament.achievements.map((achievement) => ['award', achievement.type, achievement.title, achievement.user.fullName]),
    ];

    return {
      success: true,
      data: {
        filename: `${tournament.code.toLowerCase()}-verified-results.csv`,
        csv: rows.map((row) => row.map((value) => this.csv(value ?? '')).join(',')).join('\n'),
      },
      error: null,
    };
  }

  async listDeadlineCases(userId: string, tournamentId: string) {
    await this.authorization.assertCanManageTournamentPermission(userId, tournamentId, 'VIEW_REPORTS');
    await this.syncDeadlineCases(tournamentId);
    const cases = await this.prisma.fixtureDeadlineCase.findMany({
      where: { tournamentId },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: {
        fixture: {
          select: {
            id: true,
            fixtureCode: true,
            scheduledAt: true,
            status: true,
            homeRegistration: { select: { entryName: true } },
            awayRegistration: { select: { entryName: true } },
          },
        },
      },
    });
    return { success: true, data: { cases }, error: null };
  }

  async reviewDeadlineCase(userId: string, caseId: string, dto: ReviewDeadlineCaseDto) {
    const deadlineCase = await this.prisma.fixtureDeadlineCase.findUnique({ where: { id: caseId } });
    if (!deadlineCase) throw this.notFound('Deadline case could not be found.');
    await this.authorization.assertCanManageTournamentPermission(userId, deadlineCase.tournamentId, 'MANAGE_RESULTS');
    const updated = await this.prisma.fixtureDeadlineCase.update({
      where: { id: caseId },
      data: { status: dto.status, resolutionNote: dto.resolutionNote?.trim() || null, resolvedAt: new Date() },
    });
    return { success: true, data: { case: updated }, error: null };
  }

  private async syncDeadlineCases(tournamentId: string) {
    const now = new Date();
    const overdue = await this.prisma.fixture.findMany({
      where: {
        tournamentId,
        scheduledAt: { not: null, lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        match: { is: { status: { not: 'COMPLETED' } } },
      },
      include: {
        tournament: { select: { resultDeadlineHours: true } },
        homeRegistration: { select: { members: { select: { userId: true } } } },
        awayRegistration: { select: { members: { select: { userId: true } } } },
      },
    });

    for (const fixture of overdue) {
      const dueAt = fixture.resultDeadlineAt ?? new Date(fixture.scheduledAt!.getTime() + fixture.tournament.resultDeadlineHours * 60 * 60 * 1000);
      if (dueAt > now) continue;
      const deadlineCase = await this.prisma.fixtureDeadlineCase.upsert({
        where: { fixtureId: fixture.id },
        create: { fixtureId: fixture.id, tournamentId, dueAt },
        update: { dueAt },
      });
      if (!deadlineCase.reminderSentAt && deadlineCase.status === 'OPEN') {
        const userIds = new Set([
          ...fixture.homeRegistration?.members.map((member) => member.userId) ?? [],
          ...fixture.awayRegistration?.members.map((member) => member.userId) ?? [],
        ]);
        for (const userId of userIds) {
          await this.notifications.createForUser(userId, {
            type: 'MATCH_REMINDER',
            title: 'Result deadline passed',
            message: 'This fixture is awaiting a verified result. Contact the tournament admin if the match needs review.',
            href: `/tournaments/${tournamentId}/fixtures`,
            entityType: 'FixtureDeadlineCase',
            entityId: deadlineCase.id,
            dedupeKey: `fixture-deadline:${fixture.id}:${deadlineCase.id}`,
            eventAt: now,
          });
        }
        await this.prisma.fixtureDeadlineCase.update({ where: { id: deadlineCase.id }, data: { reminderSentAt: now } });
      }
    }
  }

  private async createTournamentFromConfig(
    userId: string,
    leagueId: string,
    config: TemplateConfig,
    name: string,
    dto: CreateTournamentFromTemplateDto,
  ) {
    return this.tournaments.createTournament(userId, leagueId, {
      name: name.trim(),
      mode: config.mode,
      format: config.format,
      competitionFormat: config.competitionFormat as never,
      groupMode: config.groupMode as never,
      legType: config.legType as never,
      fixtureMode: config.fixtureMode as never,
      visibility: config.visibility as never,
      registrationMode: config.registrationMode as never,
      teamSize: config.teamSize,
      maxEntries: config.maxEntries,
      qualifiersPerGroup: config.qualifiersPerGroup ?? undefined,
      playoffPairingMethod: config.playoffPairingMethod as never,
      dailyMatchLimit: config.dailyMatchLimit,
      matchesPerParticipantPerDay: config.matchesPerParticipantPerDay,
      matchDurationMinutes: config.matchDurationMinutes,
      description: undefined,
      rules: undefined,
      logoUrl: undefined,
      startAt: dto.startAt,
      endAt: dto.endAt,
    });
  }

  private configFromTournament(tournament: {
    mode: string;
    format: string;
    competitionFormat: string;
    groupMode: string;
    legType: string;
    fixtureMode: string;
    visibility: string;
    registrationMode: string;
    teamSize: number;
    maxEntries: number;
    qualifiersPerGroup: number | null;
    playoffPairingMethod: string;
    dailyMatchLimit?: number;
    matchesPerParticipantPerDay?: number;
    matchDurationMinutes?: number;
    resultDeadlineHours?: number;
  }): TemplateConfig {
    return {
      mode: tournament.mode as TemplateConfig['mode'],
      format: tournament.format as TemplateConfig['format'],
      competitionFormat: tournament.competitionFormat,
      groupMode: tournament.groupMode,
      legType: tournament.legType,
      fixtureMode: tournament.fixtureMode,
      visibility: tournament.visibility,
      registrationMode: tournament.registrationMode,
      teamSize: tournament.teamSize,
      maxEntries: tournament.maxEntries,
      qualifiersPerGroup: tournament.qualifiersPerGroup,
      playoffPairingMethod: tournament.playoffPairingMethod,
      dailyMatchLimit: tournament.dailyMatchLimit,
      matchesPerParticipantPerDay: tournament.matchesPerParticipantPerDay,
      matchDurationMinutes: tournament.matchDurationMinutes,
      resultDeadlineHours: tournament.resultDeadlineHours,
    };
  }

  private csv(value: unknown) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  private notFound(message: string) {
    return new NotFoundException({ success: false, data: null, error: { code: 'NOT_FOUND', message } });
  }
}
