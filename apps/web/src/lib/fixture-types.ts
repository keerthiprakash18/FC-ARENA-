export interface FixtureEntryForUi {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;

  members: Array<{
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  }>;
}

export interface FixtureForUi {
  id: string;
  fixtureCode: string;
  sequence: number;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  phase?: 'STAGE' | 'PLAYOFF';
  status: string;
  scheduledAt: string | null;
  venue: string | null;
  competitionFormat?: string;
  legType?: string;

  group: {
    id: string;
    name: string;
    position: number;
  } | null;

  match: {
    id: string;
    matchCode: string | null;
    status: string;
    confirmedResult?: {
      homeScore: number;
      awayScore: number;
      status: string;
      homePenaltyScore?: number | null;
      awayPenaltyScore?: number | null;
    } | null;
  } | null;

  home:
    | FixtureEntryForUi
    | null;

  away:
    | FixtureEntryForUi
    | null;

  homeSource: {
    id: string;
    fixtureCode: string;
    outcome?: 'WINNER' | 'LOSER';
  } | null;

  awaySource: {
    id: string;
    fixtureCode: string;
    outcome?: 'WINNER' | 'LOSER';
  } | null;
}

