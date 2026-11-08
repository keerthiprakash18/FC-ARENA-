export interface ReportPlayer {
  id: string;
  name: string;
  playerCode: string | null;
  profileImageUrl: string | null;
}

export interface ReportEntry {
  id: string;
  name: string;
  logoUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  members: ReportPlayer[];
}

export interface ReportStatistics {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}

export interface ReportStanding extends ReportStatistics {
  position: number;
  entry: ReportEntry;
}

export interface ReportMatch {
  id: string;
  fixtureCode: string;
  matchId: string | null;
  roundNumber: number;
  roundName: string;
  phase: string;
  groupName: string | null;
  matchday: number | null;
  scheduledAt: string | null;
  status: string;
  home: ReportEntry | null;
  away: ReportEntry | null;
  score: {
    home: number;
    away: number;
    homePenalties: number | null;
    awayPenalties: number | null;
    confirmedAt: string | null;
  } | null;
  /** Return-leg totals, oriented to this fixture's home/away sides. */
  aggregate: { home: number; away: number; firstLegFixtureCode: string } | null;
}

export interface TournamentReport {
  reportVersion: 1;
  generatedAt: string;
  tournament: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    logoUrl: string | null;
    mode: string;
    format: string;
    competitionFormat: string;
    groupMode: string;
    legType: string;
    teamSize: number;
    status: 'COMPLETED';
    startAt: string | null;
    endAt: string | null;
    completedAt: string | null;
    league: { id: string; name: string; code: string; logoUrl: string | null };
  };
  overview: {
    teams: number;
    players: number;
    groups: number;
    fixtures: number;
    verifiedMatches: number;
    cancelledFixtures: number;
    byes: number;
    totalGoals: number;
    averageGoalsPerMatch: number;
  };
  placements: {
    champion: ReportEntry | null;
    runnerUp: ReportEntry | null;
    thirdPlace: ReportEntry[];
    source: 'PUBLISHED' | 'DERIVED' | 'UNAVAILABLE';
    publishedAt: string | null;
  };
  awards: Array<{ id: string; type: string; title: string; description: string | null; awardedAt: string; player: ReportPlayer }>;
  teams: ReportEntry[];
  standings: Array<{ id: string; name: string; kind: 'GROUP' | 'LEAGUE' | 'LEAGUE_PHASE'; rows: ReportStanding[] }>;
  /** Canonical completed-match score statistics, separate from the group/league tables. */
  teamPerformance: Array<ReportStatistics & { entry: ReportEntry }>;
  /** Team-level goals in DUO/TEAM are not represented as individual goal-scorer events. */
  players: Array<{ player: ReportPlayer; matches: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; form: string; winRate: number }>;
  matches: ReportMatch[];
  integrity: {
    scoreBasis: 'CONFIRMED_RESULTS';
    omittedUnconfirmedScores: number;
    duplicateFixturesRemoved: number;
    warnings: string[];
  };
}

export interface TournamentTeamList {
  generatedAt: string;
  tournament: Omit<TournamentReport['tournament'], 'status'> & { status: string };
  teams: ReportEntry[];
  overview: { teams: number; players: number; groups: number; pending: number };
}
