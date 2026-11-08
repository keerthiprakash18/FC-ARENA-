import { authenticatedRequest } from './auth-client';

export interface FeedEntry {
  id: string; entryName: string | null; entryLogoUrl: string | null;
  members: { id: string; fullName: string; playerCode: string | null; inGameName: string | null }[];
}
export interface FeedTournament { id: string; name: string; status: string; competitionFormat: string; legType: string }
export interface FeedFixture {
  id: string; fixtureCode: string; sequence: number; tournamentId: string; roundNumber: number; roundName: string;
  matchday: number | null; phase: string; status: string; scheduledAt: string | null; venue: string | null;
  groupId: string | null; homeRegistrationId: string | null; awayRegistrationId: string | null;
  match: { id: string; matchCode: string | null; status: string;
    confirmedResult: { homeScore: number; awayScore: number; status: string } | null } | null;
}
export interface FixtureFeedSnapshot {
  unchanged: false; version: string; leagueId: string; leagueName: string; tournaments: FeedTournament[];
  entries: Record<string, FeedEntry>; groups: Record<string, { id: string; name: string; position: number }>;
  fixtures: FeedFixture[];
}
export type FixtureFeedResult = FixtureFeedSnapshot | { unchanged: true; version: string };

export async function loadFixtureFeed(leagueId: string, version?: string, signal?: AbortSignal): Promise<FixtureFeedResult> {
  const suffix = version ? `?version=${encodeURIComponent(version)}` : '';
  const response = await authenticatedRequest<{ data: FixtureFeedResult }>(`/leagues/${encodeURIComponent(leagueId)}/fixture-feed${suffix}`, { signal });
  return response.data;
}

export function hydrateFixtureFeed(snapshot: FixtureFeedSnapshot) {
  const tournaments = new Map(snapshot.tournaments.map(tournament => [tournament.id, tournament]));
  return snapshot.fixtures.map(fixture => ({ ...fixture,
    home: fixture.homeRegistrationId ? snapshot.entries[fixture.homeRegistrationId] ?? null : null,
    away: fixture.awayRegistrationId ? snapshot.entries[fixture.awayRegistrationId] ?? null : null,
    group: fixture.groupId ? snapshot.groups[fixture.groupId] ?? null : null,
    tournamentName: tournaments.get(fixture.tournamentId)?.name ?? 'Tournament',
    competitionFormat: tournaments.get(fixture.tournamentId)?.competitionFormat,
    legType: tournaments.get(fixture.tournamentId)?.legType,
    leagueId: snapshot.leagueId, leagueName: snapshot.leagueName,
  }));
}
