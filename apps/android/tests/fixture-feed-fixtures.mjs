import { createHash } from 'node:crypto';

// API-shaped normalized schedules for browser tests, including mutable rosters.
export function makeFixtureFeed(leagueId, tournaments, fixtureLists, leagueName = 'Arena League') {
  const entries = {}, groups = {}, fixtures = [];
  for (const tournament of tournaments) for (const fixture of fixtureLists[tournament.id] ?? []) {
    for (const entry of [fixture.home, fixture.away]) if (entry) entries[entry.id] = entry;
    if (fixture.group) groups[fixture.group.id] = fixture.group;
    const { home, away, group, homeRegistration, awayRegistration, ...rest } = fixture;
    fixtures.push({ ...rest, phase: fixture.phase ?? 'STAGE', tournamentId: tournament.id,
      homeRegistrationId: home?.id ?? null, awayRegistrationId: away?.id ?? null, groupId: group?.id ?? null });
  }
  const snapshot = { leagueId, leagueName, tournaments, entries, groups, fixtures };
  return { unchanged: false, version: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 24), ...snapshot };
}
