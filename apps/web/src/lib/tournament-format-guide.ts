export interface QualificationBand {
  from: number;
  to: number;
  label: string;
  tone: 'direct' | 'playoff' | 'qualify';
}

export interface TournamentFormatDescription {
  tournamentName?: string;
  playoffFormat?: 'GLOBAL_SEEDED' | 'PROTECTED_SEED' | 'DOUBLE_CHANCE' | 'UCL_TWO_LEG' | null;
  title: string;
  competitionFormat: string;
  approvedEntries: number;
  capacity: number;
  entryLabel: string;
  teamSize: number;
  mode: string;
  groupCount: number;
  groups: { name: string; entries: number }[];
  stage: string;
  fixtureRule: string;
  matchesPerEntry: number | null;
  qualification: {
    state: 'READY' | 'PENDING' | 'NONE';
    source: string;
    total: number | null;
    direct: number | null;
    playIn: number | null;
    perGroup: number | null;
    eliminated: number | null;
    description: string;
    bands: QualificationBand[];
  };
  scoring: string | null;
  ranking: string | null;
  knockoutRule: string | null;
  note: string | null;
  provisional: boolean;
}
