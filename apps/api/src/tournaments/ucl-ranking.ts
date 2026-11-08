interface Entry { id: string; seed: number }
interface Result { homeId: string; awayId: string; homeScore: number; awayScore: number }

/** UEFA's sporting tie-breaks; tournament seed order replaces club coefficients. */
export function rankUclEntries(entries: Entry[], results: Result[]) {
  const table = new Map(entries.map(entry => [entry.id, {
    ...entry, points: 0, goalDifference: 0, goalsFor: 0, awayGoals: 0, wins: 0, awayWins: 0,
    opponentPoints: 0, opponentGoalDifference: 0, opponentGoals: 0, opponents: [] as string[],
  }]));
  for (const result of results) {
    const home = table.get(result.homeId), away = table.get(result.awayId);
    if (!home || !away || home === away) continue;
    const delta = result.homeScore - result.awayScore;
    home.points += delta > 0 ? 3 : delta === 0 ? 1 : 0;
    away.points += delta < 0 ? 3 : delta === 0 ? 1 : 0;
    home.goalDifference += delta; away.goalDifference -= delta;
    home.goalsFor += result.homeScore; away.goalsFor += result.awayScore;
    away.awayGoals += result.awayScore;
    home.wins += Number(delta > 0); away.wins += Number(delta < 0); away.awayWins += Number(delta < 0);
    home.opponents.push(away.id); away.opponents.push(home.id);
  }
  for (const row of table.values()) for (const id of row.opponents) {
    const opponent = table.get(id)!;
    row.opponentPoints += opponent.points;
    row.opponentGoalDifference += opponent.goalDifference;
    row.opponentGoals += opponent.goalsFor;
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor || b.awayGoals - a.awayGoals || b.wins - a.wins || b.awayWins - a.awayWins ||
    b.opponentPoints - a.opponentPoints || b.opponentGoalDifference - a.opponentGoalDifference ||
    b.opponentGoals - a.opponentGoals || a.seed - b.seed || a.id.localeCompare(b.id));
}
