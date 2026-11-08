import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AchievementsService } from '../achievements/achievements.service.js';
import { ResultsService } from '../results/results.service.js';
import { calculateResultDelta } from '../results/result-outcome.js';
import { isUclLeg } from '../results/ucl-ties.js';
import { deduplicateFixtureRecords, isCanonicalCompletedFixture } from './fixture-deduplication.js';
import type { ReportEntry, ReportPlayer, ReportStatistics, ReportStanding, TournamentReport } from './tournament-report.types.js';

const playerSelect = { id: true, fullName: true, player: { select: { playerCode: true, profileImageUrl: true, identity: { select: { inGameName: true } } } } } as const;
const emptyStats = (): ReportStatistics => ({ played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: '' });
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const iso = (value: unknown): string | null => {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const publicImage = (value: unknown): string | null => {
  const url = text(value);
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
};
type PublicUser = { id: string; fullName: string; player?: { playerCode: string; profileImageUrl?: string | null; identity?: { inGameName: string } | null } | null };
const player = (user: PublicUser): ReportPlayer => ({ id: user.id, name: user.player?.identity?.inGameName || user.fullName, playerCode: user.player?.playerCode ?? null, profileImageUrl: publicImage(user.player?.profileImageUrl) });

@Injectable()
export class TournamentReportService {
  constructor(private readonly prisma: PrismaService, private readonly achievements: AchievementsService, private readonly results: ResultsService) {}

  private async metadata(userId: string, tournamentId: string, requireComplete = true) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: {
      id: true, leagueId: true, name: true, code: true, description: true, logoUrl: true, mode: true, format: true,
      competitionFormat: true, groupMode: true, legType: true, teamSize: true, status: true, startAt: true, endAt: true,
      completedAt: true, league: { select: { id: true, name: true, code: true, logoUrl: true } },
    } });
    if (!tournament) throw new NotFoundException({ success: false, data: null, error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament could not be found.' } });
    const membership = await this.prisma.leagueMember.findUnique({ where: { leagueId_userId: { leagueId: tournament.leagueId, userId } }, select: { id: true } });
    if (!membership) throw new ForbiddenException({ success: false, data: null, error: { code: 'LEAGUE_MEMBERSHIP_REQUIRED', message: 'You must be a member of this League to view its report.' } });
    if (requireComplete && tournament.status !== 'COMPLETED') throw new ConflictException({ success: false, data: null, error: { code: 'TOURNAMENT_REPORT_NOT_READY', message: 'The full report is available after this tournament is completed.' } });
    return tournament;
  }

  async assertReportAccess(userId: string, tournamentId: string): Promise<void> { await this.metadata(userId, tournamentId); }

  async assertTeamListAccess(userId: string, tournamentId: string): Promise<void> { await this.metadata(userId, tournamentId, false); }

  async getTeamList(userId: string, tournamentId: string): Promise<import('./tournament-report.types.js').TournamentTeamList> {
    const tournament = await this.metadata(userId, tournamentId, false);
    const [entries, groups, pending] = await Promise.all([
      this.prisma.tournamentRegistration.findMany({ where: { tournamentId, status: 'APPROVED' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: {
        id: true, entryName: true, entryLogoUrl: true, groupId: true, members: { orderBy: { userId: 'asc' }, select: { user: { select: playerSelect } } },
      } }),
      this.prisma.tournamentGroup.findMany({ where: { tournamentId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, name: true } }),
      this.prisma.tournamentRegistration.count({ where: { tournamentId, status: 'PENDING' } }),
    ]);
    if (!entries.length) throw new ConflictException({ success: false, data: null, error: { code: 'TEAM_LIST_EMPTY', message: 'Approve or add teams before exporting the team list.' } });
    const names = new Map(groups.map(group => [group.id, group.name]));
    const teams: ReportEntry[] = entries.map(entry => ({ id: entry.id, name: entry.entryName || entry.members.map(member => player(member.user).name).join(' + ') || 'Tournament Entry', logoUrl: publicImage(entry.entryLogoUrl), groupId: entry.groupId, groupName: entry.groupId ? names.get(entry.groupId) ?? null : null, members: entry.members.map(member => player(member.user)) }));
    return { generatedAt: new Date().toISOString(), tournament: { id: tournament.id, name: tournament.name, code: tournament.code, description: tournament.description, logoUrl: publicImage(tournament.logoUrl), mode: tournament.mode, format: tournament.format, competitionFormat: tournament.competitionFormat, groupMode: tournament.groupMode, legType: tournament.legType, teamSize: tournament.teamSize, status: tournament.status, startAt: iso(tournament.startAt), endAt: iso(tournament.endAt), completedAt: iso(tournament.completedAt), league: { ...tournament.league, logoUrl: publicImage(tournament.league.logoUrl) } }, teams,
      overview: { teams: teams.length, players: new Set(teams.flatMap(team => team.members.map(member => member.id))).size, groups: groups.length, pending } };
  }

  async getReport(userId: string, tournamentId: string): Promise<TournamentReport> {
    const tournament = await this.metadata(userId, tournamentId);
    const [registrations, groups, fixtures, awards, standingsResponse, summaryResponse] = await Promise.all([
      this.prisma.tournamentRegistration.findMany({ where: { tournamentId, status: 'APPROVED' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: {
        id: true, entryName: true, entryLogoUrl: true, groupId: true, members: { orderBy: { userId: 'asc' }, select: { user: { select: playerSelect } } },
      } }),
      this.prisma.tournamentGroup.findMany({ where: { tournamentId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, name: true } }),
      this.prisma.fixture.findMany({ where: { tournamentId }, orderBy: [{ sequence: 'asc' }, { id: 'asc' }], select: {
        id: true, tournamentId: true, fixtureCode: true, groupId: true, sequence: true, roundNumber: true, roundName: true,
        bracketPosition: true, phase: true, matchday: true, scheduledAt: true, status: true, homeRegistrationId: true, awayRegistrationId: true,
        match: { select: { id: true, status: true, confirmedResultSubmissionId: true, confirmedResult: { select: {
          id: true, status: true, homeScore: true, awayScore: true, homePenaltyScore: true, awayPenaltyScore: true, reviewedAt: true,
        } } } },
      } }),
      this.prisma.achievement.findMany({ where: { tournamentId }, orderBy: [{ awardedAt: 'asc' }, { id: 'asc' }], select: { id: true, type: true, title: true, description: true, awardedAt: true, user: { select: playerSelect } } }),
      this.results.getStandings(userId, tournamentId),
      this.achievements.getTournamentSummary(userId, tournamentId).catch(error => {
        // Legacy completed tournaments can lack an unambiguous published placement.
        // Keep their verified record available, without guessing a winner.
        if (error instanceof ConflictException) return null;
        throw error;
      }),
    ]);
    const warnings: string[] = [];
    const groupNames = new Map(groups.map(group => [group.id, group.name]));
    const teams: ReportEntry[] = registrations.map(entry => ({ id: entry.id, name: entry.entryName || entry.members.map(member => player(member.user).name).join(' + ') || 'Tournament Entry', logoUrl: publicImage(entry.entryLogoUrl), groupId: entry.groupId, groupName: entry.groupId ? groupNames.get(entry.groupId) ?? null : null, members: entry.members.map(member => player(member.user)) }));
    const byId = new Map(teams.map(team => [team.id, team]));
    const fromSnapshot = (input: unknown): ReportEntry | null => {
      const source = record(input), id = text(source.registrationId) ?? text(source.id);
      if (!id) return null;
      const current = byId.get(id);
      const members = Array.isArray(source.members) ? source.members.map(value => {
        const member = record(value), memberId = text(member.userId) ?? text(member.id);
        return memberId ? { id: memberId, name: text(member.name) ?? 'Player', playerCode: text(member.playerCode), profileImageUrl: publicImage(member.profileImageUrl) } : null;
      }).filter((member): member is ReportPlayer => member !== null) : current?.members ?? [];
      return { id, name: text(source.name) ?? current?.name ?? 'Tournament Entry', logoUrl: publicImage(source.logoUrl) ?? current?.logoUrl ?? null, groupId: current?.groupId ?? null, groupName: current?.groupName ?? null, members };
    };
    const snapshot = record(summaryResponse?.data.summary), placement = record(snapshot.placements);
    const placements: TournamentReport['placements'] = {
      champion: fromSnapshot(placement.champion), runnerUp: fromSnapshot(placement.runnerUp),
      thirdPlace: Array.isArray(placement.thirdPlace) ? placement.thirdPlace.map(fromSnapshot).filter((entry): entry is ReportEntry => entry !== null) : [],
      source: summaryResponse ? summaryResponse.data.legacyDerived ? 'DERIVED' : 'PUBLISHED' : 'UNAVAILABLE',
      publishedAt: iso(summaryResponse?.data.publishedAt),
    };
    if (!placements.champion) warnings.push('Published champion details are unavailable. The report does not infer a champion from a performance table.');
    if (placements.source === 'DERIVED') warnings.push('This legacy tournament has no published summary snapshot; placements use the existing official summary calculation.');

    const canonical = deduplicateFixtureRecords(fixtures, tournament.competitionFormat, tournament.legType);
    const totals = new Map(teams.map(team => [team.id, emptyStats()]));
    const matches: TournamentReport['matches'] = canonical.map(fixture => {
      const result = isCanonicalCompletedFixture(fixture) ? fixture.match!.confirmedResult! : null;
      let aggregate: TournamentReport['matches'][number]['aggregate'] = null;
      if (result && isUclLeg(fixture) && fixture.matchday === 2) {
        const first = canonical.find(row => row.id !== fixture.id && row.roundNumber === fixture.roundNumber && row.bracketPosition === fixture.bracketPosition && row.phase === fixture.phase && row.matchday === 1 && row.homeRegistrationId === fixture.awayRegistrationId && row.awayRegistrationId === fixture.homeRegistrationId && isCanonicalCompletedFixture(row));
        if (first?.match?.confirmedResult) aggregate = { home: result.homeScore + first.match.confirmedResult.awayScore, away: result.awayScore + first.match.confirmedResult.homeScore, firstLegFixtureCode: first.fixtureCode };
      }
      if (result) {
        for (const [id, goalsFor, goalsAgainst] of [[fixture.homeRegistrationId, result.homeScore, result.awayScore], [fixture.awayRegistrationId, result.awayScore, result.homeScore]] as const) {
          const stats = id ? totals.get(id) : null;
          if (!stats) continue;
          const delta = calculateResultDelta(goalsFor, goalsAgainst);
          stats.played++;
          for (const key of ['wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'goalDifference', 'points'] as const) stats[key] += delta[key];
          stats.form = (stats.form + delta.outcome).slice(-10);
        }
      }
      const bye = !result && !fixture.match && fixture.status === 'COMPLETED' && Boolean(fixture.homeRegistrationId) !== Boolean(fixture.awayRegistrationId);
      return { id: fixture.id, fixtureCode: fixture.fixtureCode, matchId: fixture.match?.id ?? null, roundNumber: fixture.roundNumber, roundName: fixture.roundName, phase: fixture.phase, groupName: fixture.groupId ? groupNames.get(fixture.groupId) ?? null : null, matchday: fixture.matchday, scheduledAt: iso(fixture.scheduledAt), status: fixture.match?.status === 'CANCELLED' ? 'CANCELLED' : bye ? 'BYE' : fixture.status,
        home: fixture.homeRegistrationId ? byId.get(fixture.homeRegistrationId) ?? null : null, away: fixture.awayRegistrationId ? byId.get(fixture.awayRegistrationId) ?? null : null,
        score: result ? { home: result.homeScore, away: result.awayScore, homePenalties: result.homePenaltyScore, awayPenalties: result.awayPenaltyScore, confirmedAt: iso(result.reviewedAt) } : null, aggregate };
    });
    const omittedUnconfirmedScores = canonical.filter(fixture => fixture.homeRegistrationId && fixture.awayRegistrationId && fixture.status !== 'CANCELLED' && fixture.match?.status !== 'CANCELLED' && !isCanonicalCompletedFixture(fixture)).length;
    if (omittedUnconfirmedScores) warnings.push(`${omittedUnconfirmedScores} fixture(s) have no canonical confirmed score; unverified or stale scores are omitted.`);
    if (fixtures.length !== canonical.length) warnings.push(`${fixtures.length - canonical.length} duplicate fixture record(s) were excluded using the app's canonical fixture rules.`);
    if (canonical.some(fixture => (fixture.homeRegistrationId && !byId.has(fixture.homeRegistrationId)) || (fixture.awayRegistrationId && !byId.has(fixture.awayRegistrationId)))) warnings.push('Some historical fixture participants no longer have an approved registration. Their missing identity is not treated as a bye.');
    if (tournament.mode !== 'SOLO') warnings.push('Player goals for/against describe their team results; individual goal scorers and assists are not recorded from team-level scores.');

    const tableRows: ReportStanding[] = standingsResponse.data.standings.flatMap(row => {
      const entry = byId.get(row.registrationId);
      return entry ? [{ position: row.position, entry, played: row.played, wins: row.wins, draws: row.draws, losses: row.losses, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference, points: row.points, form: row.form }] : [];
    });
    const standings: TournamentReport['standings'] = groups.length ? groups.map(group => ({ id: group.id, name: group.name, kind: 'GROUP', rows: tableRows.filter(row => row.entry.groupId === group.id).map((row, index) => ({ ...row, position: index + 1 })) })) : tournament.format === 'KNOCKOUT' ? [] : [{ id: 'overall', name: tournament.competitionFormat === 'UCL_CUP' ? 'League Phase' : 'Final League Table', kind: tournament.competitionFormat === 'UCL_CUP' ? 'LEAGUE_PHASE' : 'LEAGUE', rows: tableRows }];
    const teamPerformance = teams.map(entry => ({ entry, ...totals.get(entry.id)! })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.entry.name.localeCompare(b.entry.name));
    const participants = new Map<string, TournamentReport['players'][number]>();
    for (const entry of teams) for (const member of entry.members) {
      const stats = totals.get(entry.id)!;
      const current = participants.get(member.id) ?? { player: member, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: '', winRate: 0 };
      current.matches += stats.played;
      for (const key of ['wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'goalDifference'] as const) current[key] += stats[key];
      current.form = (current.form + stats.form).slice(-10);
      current.winRate = current.matches ? Math.round(current.wins / current.matches * 1000) / 10 : 0;
      participants.set(member.id, current);
    }
    const verified = matches.filter(match => match.score);
    const totalGoals = verified.reduce((sum, match) => sum + match.score!.home + match.score!.away, 0);
    return { reportVersion: 1, generatedAt: new Date().toISOString(), tournament: { id: tournament.id, name: tournament.name, code: tournament.code, description: tournament.description, logoUrl: publicImage(tournament.logoUrl), mode: tournament.mode, format: tournament.format, competitionFormat: tournament.competitionFormat, groupMode: tournament.groupMode, legType: tournament.legType, teamSize: tournament.teamSize, status: 'COMPLETED', startAt: iso(tournament.startAt), endAt: iso(tournament.endAt), completedAt: iso(tournament.completedAt), league: { ...tournament.league, logoUrl: publicImage(tournament.league.logoUrl) } },
      overview: { teams: teams.length, players: participants.size, groups: groups.length, fixtures: matches.length, verifiedMatches: verified.length, cancelledFixtures: matches.filter(match => match.status === 'CANCELLED').length, byes: matches.filter(match => match.status === 'BYE').length, totalGoals, averageGoalsPerMatch: verified.length ? Math.round(totalGoals / verified.length * 100) / 100 : 0 },
      placements, awards: awards.map(award => ({ id: award.id, type: award.type, title: award.title, description: award.description, awardedAt: award.awardedAt.toISOString(), player: player(award.user) })), teams, standings, teamPerformance,
      players: [...participants.values()].sort((a, b) => b.wins * 3 + b.draws - (a.wins * 3 + a.draws) || b.goalDifference - a.goalDifference || a.player.name.localeCompare(b.player.name)), matches,
      integrity: { scoreBasis: 'CONFIRMED_RESULTS', omittedUnconfirmedScores, duplicateFixturesRemoved: fixtures.length - canonical.length, warnings } };
  }
}
