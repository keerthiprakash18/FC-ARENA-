import { BadRequestException, ConflictException } from '@nestjs/common';
import { parseDuoGames, validateDuoAggregate, type DuoGameScore } from './duo-aggregate.js';

export interface SavedDuoGame extends DuoGameScore { version: number }
export interface DuoProgress { revision: number; games: SavedDuoGame[]; homePlayerIds?: string[]; awayPlayerIds?: string[] }
interface Tournament { mode: string; duoAggregateEnabled: boolean; duoGamesPerFixture?: number }
const goal = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 99;

export function readDuoProgress(value: unknown): DuoProgress {
  if (value === null || value === undefined) return { revision: 0, games: [] };
  if (typeof value !== 'object' || Array.isArray(value)) throw new ConflictException('Saved Duo scores could not be read. Contact an administrator.');
  const stored = value as Partial<DuoProgress>;
  if (!Number.isSafeInteger(stored.revision) || Number(stored.revision) < 0 || !Array.isArray(stored.games) || stored.games.length > 4 ||
    stored.games.some(game => !game || typeof game.homePlayerId !== 'string' || typeof game.awayPlayerId !== 'string' ||
      !goal(game.homeGoals) || !goal(game.awayGoals) || !Number.isSafeInteger(game.version) || game.version < 1)) {
    throw new ConflictException('Saved Duo scores could not be read. Contact an administrator.');
  }
  for (const ids of [stored.homePlayerIds, stored.awayPlayerIds]) {
    if (ids !== undefined && (!Array.isArray(ids) || ids.length !== 2 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== 2)) {
      throw new ConflictException('Saved Duo lineup could not be read. Contact an administrator.');
    }
  }
  return { ...(stored.homePlayerIds ? { homePlayerIds: [...stored.homePlayerIds] } : {}),
    ...(stored.awayPlayerIds ? { awayPlayerIds: [...stored.awayPlayerIds] } : {}), revision: stored.revision!, games: stored.games.map(game => ({ homePlayerId: game.homePlayerId, awayPlayerId: game.awayPlayerId, homeGoals: game.homeGoals, awayGoals: game.awayGoals, version: game.version })) };
}

type Member = { userId: string };
export type DuoReplacement = { beforeData: unknown; afterData: unknown };
export type DuoAliases = { home: ReadonlyMap<string, string>; away: ReadonlyMap<string, string> };
const noAliases: DuoAliases = { home: new Map(), away: new Map() };
const playerId = (value: unknown): string | undefined => value && typeof value === 'object' &&
  'userId' in value && typeof value.userId === 'string' ? value.userId : undefined;
const lineupError = () => new ConflictException('Saved Duo game participants cannot be matched to the current team slots. Contact the tournament owner; saved scores are unchanged.');

/** Only authoritative registration replacement audit events may associate old participants with current slots. */
export function duoReplacementAliases(current: readonly Member[], history: readonly DuoReplacement[], historical: readonly string[]) {
  const active = new Set(current.map(member => member.userId));
  const aliases = new Map<string, string>();
  for (const id of new Set(historical)) {
    if (active.has(id)) continue;
    const destinations = new Set<string>();
    // An ID may have been replaced more than once. Follow each possible chronological chain.
    for (let i = 0; i < history.length; i++) {
      if (playerId(history[i]!.beforeData) !== id) continue;
      let next = playerId(history[i]!.afterData);
      for (const event of history.slice(i + 1)) {
        if (playerId(event.beforeData) === next) next = playerId(event.afterData);
      }
      if (next && active.has(next)) destinations.add(next);
    }
    if (destinations.size !== 1) throw lineupError();
    aliases.set(id, [...destinations][0]!);
  }
  return aliases;
}

type Pair = Pick<DuoGameScore, 'homePlayerId' | 'awayPlayerId'>;
const pairKey = (game: Pair) => JSON.stringify([game.homePlayerId, game.awayPlayerId]);
const ordered = (members: readonly Member[]) => [...members].sort((a,b) => a.userId.localeCompare(b.userId));
function normalizePair<T extends Pair>(game: T, home: readonly Member[], away: readonly Member[], aliases: DuoAliases): T {
  const homePlayerId = aliases.home.get(game.homePlayerId) ?? game.homePlayerId;
  const awayPlayerId = aliases.away.get(game.awayPlayerId) ?? game.awayPlayerId;
  if (!home.some(member => member.userId === homePlayerId) || !away.some(member => member.userId === awayPlayerId)) throw lineupError();
  return { ...game, homePlayerId, awayPlayerId };
}

/** Current roster is authoritative for all unplayed slots. Saved rows retain the actual players. */
export function duoFixturePlan(progress: DuoProgress, homeMembers: readonly Member[], awayMembers: readonly Member[],
  count: number, aliases: DuoAliases = noAliases) {
  const home = ordered(homeMembers), away = ordered(awayMembers);
  if (home.length !== 2 || away.length !== 2 || new Set(home.map(m => m.userId)).size !== 2 ||
      new Set(away.map(m => m.userId)).size !== 2 || home.some(m => away.some(a => a.userId === m.userId))) throw lineupError();
  const slots = progress.games.map(game => normalizePair(game, home, away, aliases));
  if (slots.length > count || new Set(slots.map(pairKey)).size !== slots.length) throw lineupError();
  if (count === 2 && (new Set(slots.map(g => g.homePlayerId)).size !== slots.length ||
    new Set(slots.map(g => g.awayPlayerId)).size !== slots.length)) throw lineupError();
  const swap = slots.length > 0 && home.findIndex(m => m.userId === slots[0]!.homePlayerId) !==
    away.findIndex(m => m.userId === slots[0]!.awayPlayerId);
  const pairings = home.flatMap((member, i) => (count === 4 ? away : [away[swap ? 1-i : i]!]).map(opponent => {
    const slot = { homePlayerId: member.userId, awayPlayerId: opponent.userId };
    const index = slots.findIndex(game => pairKey(game) === pairKey(slot));
    const saved = index < 0 ? undefined : progress.games[index];
    return saved ? { homePlayerId: saved.homePlayerId, awayPlayerId: saved.awayPlayerId } : slot;
  }));
  if (progress.games.some(game => !pairings.some(pair => pairKey(pair) === pairKey(game)))) throw lineupError();
  return { home, away, pairings };
}

/** Validate slot coverage without relabelling the actual persisted player IDs. */
export function validateDuoFixtureResult(tournament: Tournament, home: readonly Member[], away: readonly Member[],
  scores: { homeScore: number; awayScore: number; duoGames?: unknown }, progress: DuoProgress, aliases: DuoAliases = noAliases,
  alreadySubmitted = false) {
  if (!tournament.duoAggregateEnabled) return validateDuoAggregate(tournament, home, away, scores);
  if (!Array.isArray(scores.duoGames)) return validateDuoAggregate(tournament, home, away, scores);
  // Never accept a departed participant supplied by a new all-at-once client.
  if (!progress.games.length && !alreadySubmitted) return validateDuoAggregate(tournament, home, away, scores);
  // Use the shared parser first, then validate normalized slot coverage and exact totals.
  const games = parseDuoGames(scores.duoGames);
  if (!games) throw new BadRequestException('Enter all valid Duo game scores.');
  if (progress.games.length) assertSavedDuoGamesMatch(progress, games);
  const normalized = games.map(game => normalizePair(game, home, away, aliases));
  validateDuoAggregate(tournament, home, away, { ...scores, duoGames: normalized });
  return games;
}

export function duoProgressSummary(progress: DuoProgress, requiredGames: number) {
  return { ...progress, requiredGames, completedGames: progress.games.length,
    homeScore: progress.games.reduce((sum, game) => sum + game.homeGoals, 0),
    awayScore: progress.games.reduce((sum, game) => sum + game.awayGoals, 0),
    complete: progress.games.length === requiredGames };
}

export function saveDuoGameProgress(tournament: Tournament, home: readonly Member[], away: readonly Member[],
  progress: DuoProgress, input: DuoGameScore & { expectedVersion: number }, aliases: DuoAliases = noAliases): DuoProgress {
  if (tournament.mode !== 'DUO' || !tournament.duoAggregateEnabled || home.length !== 2 || away.length !== 2) {
    throw new BadRequestException('Individual game saving requires an aggregate Duo fixture with two players on each side.');
  }
  const count = tournament.duoGamesPerFixture === 4 ? 4 : 2;
  const plan = duoFixturePlan(progress, home, away, count, aliases);
  const existing = progress.games.find(game => pairKey(game) === pairKey(input));
  const validPair = plan.pairings.some(pair => pairKey(pair) === pairKey(input)) ||
    (count === 2 && !progress.games.length && home.some(m => m.userId === input.homePlayerId) && away.some(m => m.userId === input.awayPlayerId));
  if (!validPair || !goal(input.homeGoals) || !goal(input.awayGoals)) {
    throw new BadRequestException('Choose this fixture’s current players for unsaved games, or edit a saved game, and enter whole-number scores from 0 to 99.');
  }
  const identical = existing?.homeGoals === input.homeGoals && existing?.awayGoals === input.awayGoals;
  if (input.expectedVersion !== (existing?.version ?? 0) && !identical) {
    throw new ConflictException('This game was updated elsewhere. Reload its saved score before changing it.');
  }
  if (identical) return progress;
  const games = progress.games.filter(game => game !== existing);
  games.push({ homePlayerId: input.homePlayerId, awayPlayerId: input.awayPlayerId, homeGoals: input.homeGoals, awayGoals: input.awayGoals, version: (existing?.version ?? 0) + 1 });
  const updated = { revision: progress.revision + 1, games, homePlayerIds: plan.home.map(member => member.userId), awayPlayerIds: plan.away.map(member => member.userId) };
  duoFixturePlan(updated, home, away, count, aliases);
  const summary = duoProgressSummary(updated, count);
  if (summary.homeScore > 99 || summary.awayScore > 99) throw new BadRequestException('The combined score must be 99 or fewer goals per side.');
  return updated;
}

export function assertSavedDuoGamesMatch(progress: DuoProgress, games: DuoGameScore[]) {
  if (!progress.games.length) return; // Existing all-at-once clients remain supported.
  const key = (game: DuoGameScore) => JSON.stringify([game.homePlayerId, game.awayPlayerId, game.homeGoals, game.awayGoals]);
  if (progress.games.length !== games.length || progress.games.map(key).sort().join('|') !== games.map(key).sort().join('|')) {
    throw new ConflictException('Save every Duo game and reload the latest scores before submitting the fixture.');
  }
}
