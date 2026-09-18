import {
  authenticatedRequest,
} from '@/lib/auth-client';

export interface HubTournament {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
  name: string;
  code: string;
  description: string | null;
  mode:
    | 'SOLO'
    | 'DUO'
    | 'TEAM';
  format:
    | 'ROUND_ROBIN'
    | 'KNOCKOUT';
  status: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
}

export interface HubFixtureEntry {
  id: string;
  entryName: string | null;
  members: Array<{
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  }>;
}

export interface HubFixture {
  id: string;
  fixtureCode: string;
  sequence: number;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  status: string;
  scheduledAt: string | null;
  venue: string | null;
  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;
  home: HubFixtureEntry | null;
  away: HubFixtureEntry | null;
  tournament: HubTournament;
}

interface MyLeague {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
    code: string;
  };
}

interface LeagueTournament {
  id: string;
  name: string;
  code: string;
  description: string | null;
  mode:
    | 'SOLO'
    | 'DUO'
    | 'TEAM';
  format:
    | 'ROUND_ROBIN'
    | 'KNOCKOUT';
  status: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
}

interface FixtureResponse {
  id: string;
  fixtureCode: string;
  sequence: number;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  status: string;
  scheduledAt: string | null;
  venue: string | null;
  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;
  home: HubFixtureEntry | null;
  away: HubFixtureEntry | null;
}

export async function loadAccessibleTournaments() {
  const memberships =
    await authenticatedRequest<{
      data: {
        leagues: MyLeague[];
      };
    }>('/leagues/my');

  const groups =
    await Promise.all(
      memberships.data.leagues.map(
        async (membership) => {
          const response =
            await authenticatedRequest<{
              data: {
                tournaments:
                  LeagueTournament[];
              };
            }>(
              `/leagues/${membership.league.id}/tournaments`,
            );

          return response.data.tournaments.map(
            (tournament) => ({
              ...tournament,
              leagueId:
                membership.league.id,
              leagueName:
                membership.league.name,
              leagueCode:
                membership.league.code,
              adminRole:
                membership.adminRole,
            }),
          );
        },
      ),
    );

  return groups.flat();
}

export async function loadAccessibleFixtures(
  tournaments?: HubTournament[],
) {
  const competitions =
    tournaments ??
    (await loadAccessibleTournaments());

  const fixtureGroups =
    await Promise.all(
      competitions.map(
        async (tournament) => {
          const response =
            await authenticatedRequest<{
              data: {
                fixtures:
                  FixtureResponse[];
              };
            }>(
              `/tournaments/${tournament.id}/fixtures`,
            );

          return response.data.fixtures.map(
            (fixture) => ({
              ...fixture,
              tournament,
            }),
          );
        },
      ),
    );

  return fixtureGroups.flat();
}

export function hubEntryName(
  entry: HubFixtureEntry | null,
) {
  if (!entry) {
    return 'TBD';
  }

  if (entry.entryName) {
    return entry.entryName;
  }

  const names =
    entry.members
      .map(
        (member) =>
          member.inGameName ||
          member.fullName,
      )
      .filter(Boolean);

  return names.length > 0
    ? names.join(' + ')
    : 'TBD';
}

export function fixtureGroupName(
  roundName: string,
) {
  const match =
    /^GROUP\s+([A-Z]+)\s+•\s+/i.exec(
      roundName,
    );

  return match?.[1]
    ? `Group ${match[1].toUpperCase()}`
    : null;
}
