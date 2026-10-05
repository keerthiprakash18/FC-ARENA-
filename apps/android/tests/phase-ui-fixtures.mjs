// Shared, isolated modernization fixtures. Values are never sent to production.
export const tournament = {
  id: 'phase3', code: 'PHASE3', name: 'Responsive Cup', logoUrl: null,
  description: 'Competition fixture', rules: '', mode: 'SOLO', status: 'DRAFT',
  format: 'ROUND_ROBIN', competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS',
  legType: 'SINGLE_LEG', fixtureMode: 'AUTOMATIC', visibility: 'LEAGUE', registrationMode: 'APPROVAL',
  maxEntries: 8, teamSize: 1, startAt: null, endAt: null, approvedEntries: 2,
  league: { id: 'phase3', name: 'Arena League', code: 'P3', region: 'Global', logoUrl: null },
};
export const entries = [1, 2].map(number => ({
  id: `entry-${number}`, entryName: `Competition Entry ${number}`, entryLogoUrl: null,
  sortOrder: number, status: 'APPROVED', fixtureCount: 0, groupId: 'group-1',
  members: [{ id: number === 1 ? 'phase3' : 'opponent', fullName: `Player ${number}`, inGameName: `Player ${number}` }],
}));
export const draft = {
  fixtureListName: 'Responsive fixtures', participantType: 'PLAYER', leagueId: 'phase3', tournamentId: 'phase3',
  scope: 'TOURNAMENT', groupId: null, meetings: 'SINGLE', method: 'ROUND_ROBIN', participantCount: 2,
  selectedRegistrationIds: entries.map(entry => entry.id),
  participants: entries.map(entry => ({ registrationId: entry.id, name: entry.entryName, source: 'TOURNAMENT' })),
  homeAwayMode: 'BALANCED', matchdayPrefix: 'Matchday', startDate: '', matchdayIntervalDays: 1, defaultMatchTime: '',
};
const fixture = {
  id: 'fixture-1', sequence: 1, roundNumber: 1, roundName: 'Round 1', matchday: 1, status: 'SCHEDULED',
  scheduledAt: null, venue: null, group: { id: 'group-1', name: 'Group A' },
  homeRegistration: entries[0], awayRegistration: entries[1], home: entries[0], away: entries[1],
  homeSource: null, awaySource: null,
};
const player = { id: 'phase3', fullName: 'Phase Three Player', inGameName: 'Phase Three Player', playerCode: 'P3', profileImageUrl: null };
const sideScore = { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
export const war = {
  id: 'phase3', name: 'Arena Rivalry', status: 'LIVE', playerCount: 1, legType: 'SINGLE_LEG', pairingMode: 'SLOT',
  winPoints: 3, drawPoints: 1, lossPoints: 0, challengeExpiresAt: null, scheduledStartAt: null,
  deadlineAt: '2027-01-01T12:00:00Z', acceptedAt: null, homeReadyAt: null, awayReadyAt: null,
  homeRosterLockedAt: null, awayRosterLockedAt: null, rejectedAt: null, rejectionReason: null,
  cancelledAt: null, cancellationReason: null, startedAt: null, completedAt: null, winnerLeagueId: null, rematchOfWarId: null,
  homeLeague: tournament.league, awayLeague: { ...tournament.league, id: 'opponent-league', name: 'Opponent League' },
  readiness: { home: true, away: true },
  permissions: { canManageHome: false, canManageAway: false, canAccept: false, canReject: false, canCancel: false, canStart: false, canUpdateResults: false, canComplete: false, canRematch: false },
  roster: { home: [], away: [] }, candidates: { home: [], away: [] }, matches: [],
  summary: { completedMatches: 0, totalMatches: 1, remainingMatches: 1, home: sideScore, away: sideScore, leaderLeagueId: null, tieBreakOrder: ['POINTS', 'GOAL_DIFFERENCE'] },
  playerStats: [], mvp: null,
  rivalry: { previousWars: 0, homeWins: 0, awayWins: 0, draws: 0, homeBattlePoints: 0, awayBattlePoints: 0, recent: [] },
};
const dispute = { id: 'dispute-1', matchId: 'result-test', reason: 'Incorrect result', evidenceUrl: null, status: 'OPEN', resolutionNote: null, raisedByName: player.fullName, raisedByInGameName: null, resolvedByName: null, tournamentName: tournament.name, tournamentCode: 'PHASE3', leagueName: 'Arena League', roundName: 'Round 1', fixtureCode: 'F1', createdAt: '2026-10-01T12:00:00Z', resolvedAt: null };
const report = { id: 'report-1', reporter: { userId: 'phase3', ...player }, target: { userId: 'opponent', ...player, fullName: 'Opponent Player' }, reason: 'ABUSE', contentType: 'PROFILE', details: 'Review fixture', contentReference: null, status: 'OPEN', reportsAgainstTarget: 1, createdAt: '2026-10-01T12:00:00Z', resolution: null };
export const phaseData = {
  '/api/leagues/my': { leagues: [{ membershipType: 'PRIMARY', adminRole: 'OWNER', league: { ...tournament.league, members: 2, maxMembers: 20 } }] },
  '/api/leagues/phase3/tournaments': { tournaments: [tournament] },
  '/api/leagues/phase3': { league: { ...tournament.league, members: 2, maxMembers: 20, pendingApplications: 0, membershipType: 'PRIMARY', adminRole: 'OWNER', creator: { id: 'phase3', fullName: 'Test Admin' } } },
  '/api/leagues/phase3/members': { members: [] },
  '/api/leagues/phase3/rankings': {
    league: tournament.league, filter: { mode: null }, summary: { members: 2, rankedPlayers: 1, tournaments: 1, verifiedMatches: 4, lastUpdatedAt: null }, myPosition: 1,
    rankings: [{ position: 1, userId: 'phase3', fullName: player.fullName, playerCode: 'P3', inGameName: null, profileImageUrl: null, tournamentsPlayed: 1, matches: 4, wins: 2, draws: 1, losses: 1, goalsFor: 6, goalsAgainst: 4, goalDifference: 2, winRate: 50, performancePoints: 10, form: 'WWDL' }],
  },
  '/api/tournaments/phase3': { tournament },
  '/api/tournaments/phase3/wizard': { currentStep: 'SETUP', steps: ['SETUP', 'TEAMS', 'GROUPS', 'FIXTURE_SETTINGS', 'FIXTURE_PREVIEW', 'QUALIFICATION', 'REVIEW'] },
  '/api/tournaments/phase3/entries': { tournament, entries },
  '/api/tournaments/phase3/groups': { tournament, groups: [{ id: 'group-1', name: 'Group A', position: 1, entries }], unassigned: [] },
  '/api/tournaments/phase3/my-statistics': { statistic: null },
  '/api/tournaments/phase3/fixtures': { tournament, fixtures: [{ ...fixture, fixtureCode: 'F1', bracketPosition: 1, stage: 'KNOCKOUT', group: null, match: null }] },
  '/api/tournaments/phase3/standings': { tournament, standings: entries.map((entry, index) => ({ registrationId: entry.id, entryName: entry.entryName, position: index + 1, played: 4, wins: 2, draws: 1, losses: 1, goalsFor: 6, goalsAgainst: 4, goalDifference: 2, points: 7, form: 'WWDL' })) },
  '/api/tournaments/phase3/wizard/fixture-settings': { fixtureMode: 'AUTOMATIC', legType: 'SINGLE_LEG', dailyMatchLimit: 20, matchDurationMinutes: 30 },
  '/api/tournaments/phase3/wizard/fixture-preview': { tournament, fixtures: [fixture], summary: { totalFixtures: 1, rounds: 1 } },
  '/api/tournaments/phase3/wizard/review': { tournament, approvedEntries: 2, groups: 1, totalFixtures: 1, fixtures: 1, groupFixtureCounts: [], warnings: [] },
  '/api/league-wars': { wars: [] },
  '/api/league-wars/rankings': { leagueRankings: [], playerRankings: [] },
  '/api/league-wars/phase3': { war },
  '/api/admin/disputes': { disputes: [dispute, { ...dispute, id: 'dispute-2', status: 'RESOLVED', resolutionNote: 'Reviewed', resolvedByName: 'Admin' }] },
  '/api/safety/admin/reports': { reports: [report, { ...report, id: 'report-2', status: 'DISMISSED', resolution: { decision: 'DISMISSED', note: 'Reviewed', resolvedAt: '2026-10-02T12:00:00Z' } }] },
  '/api/admin/fair-play': { policy: [], leagues: [], pendingAppeals: [], events: [] },
  '/api/admin/ops/overview': {
    scope: { global: true, leagueIds: ['phase3'] },
    totals: { players: 2, leagues: 1, tournaments: 1, activeTournaments: 1, completedTournaments: 0, scheduledMatches: 1, liveMatches: 0, completedMatches: 4, pendingResults: 1, openDisputes: 1, pendingApplications: 1, activeWars: 1, pushDevices: 0 },
    trend: { label: 'Last 7 days', days: [] }, alerts: { staleScheduledMatches: 0, oldPendingResults: 0, oldOpenDisputes: 0, total: 0 }, topLeagues: [], recentAudit: [],
  },
  '/api/admin/ops/system': {
    status: 'HEALTHY', checkedAt: '2026-10-05T12:00:00Z', runtime: { environment: 'test', node: '24', uptimeSeconds: 60, memory: { rssMb: 40, heapUsedMb: 20, heapTotalMb: 30 } },
    database: { connected: true, latencyMs: 1 }, auth: { activeSessions: 1 }, push: { configured: false, devices: 0, pendingDeliveries: 0, failedDeliveries: 0 }, moderation: { openDisputes: 1, pendingResults: 1 },
    backup: { reportingConfigured: false, healthy: true, ageHours: null, latest: null, latestSuccess: null, latestFailure: null },
  },
};
