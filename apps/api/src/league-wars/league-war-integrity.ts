import { ConflictException } from '@nestjs/common';

interface WarMatch {
  leg: number;
  homePlayerUserId: string;
  awayPlayerUserId: string;
  status: string;
  resultStatus: string;
  homeScore: number | null;
  awayScore: number | null;
}

// Home/Away war rules award configured points for each leg independently.
// Leg two must be the exact reverse pairing; this does not invent an away-goal
// or aggregate-match-winner rule.
export function assertCompleteWarFixtures(
  war: { playerCount: number; legType: string; homeLeagueId: string; awayLeagueId: string },
  roster: Array<{ leagueId: string; userId: string }>,
  matches: WarMatch[],
): void {
  const home = new Set(roster.filter((row) => row.leagueId === war.homeLeagueId).map((row) => row.userId));
  const away = new Set(roster.filter((row) => row.leagueId === war.awayLeagueId).map((row) => row.userId));
  const legs = war.legType === 'HOME_AWAY' ? 2 : 1;
  const seenHome = new Set<string>();
  const seenAway = new Set<string>();
  const pairs = new Set<string>();
  let valid = home.size === war.playerCount && away.size === war.playerCount && matches.length === war.playerCount * legs;
  for (const match of matches.filter((row) => row.leg === 1)) {
    if (!home.has(match.homePlayerUserId) || !away.has(match.awayPlayerUserId) || seenHome.has(match.homePlayerUserId) || seenAway.has(match.awayPlayerUserId)) valid = false;
    seenHome.add(match.homePlayerUserId);
    seenAway.add(match.awayPlayerUserId);
    pairs.add(`${match.homePlayerUserId}:${match.awayPlayerUserId}`);
  }
  valid &&= seenHome.size === war.playerCount && seenAway.size === war.playerCount;
  const returnPairs = new Set<string>();
  for (const match of matches) {
    if (match.leg === 2 && legs === 2) {
      const pair = `${match.awayPlayerUserId}:${match.homePlayerUserId}`;
      if (!pairs.has(pair) || returnPairs.has(pair)) valid = false;
      returnPairs.add(pair);
    } else if (match.leg !== 1) {
      valid = false;
    }
    if (match.status !== 'COMPLETED' || !['CONFIRMED', 'WALKOVER_CONFIRMED'].includes(match.resultStatus) || match.homeScore === null || match.awayScore === null) valid = false;
  }
  if (legs === 2 && returnPairs.size !== war.playerCount) valid = false;
  if (!valid) {
    throw new ConflictException({ success: false, data: null, error: {
      code: 'LEAGUE_WAR_MATCHES_INCOMPLETE',
      message: 'Every configured pairing and leg must exist and be confirmed before the War can be completed.',
    } });
  }
}
