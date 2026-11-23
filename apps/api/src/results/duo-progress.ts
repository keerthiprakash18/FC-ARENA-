import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DuoGameScore } from './duo-aggregate.js';

export interface SavedDuoGame extends DuoGameScore { version: number }
export interface DuoProgress { revision: number; games: SavedDuoGame[] }
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
  return { revision: stored.revision!, games: stored.games.map(game => ({ homePlayerId: game.homePlayerId, awayPlayerId: game.awayPlayerId, homeGoals: game.homeGoals, awayGoals: game.awayGoals, version: game.version })) };
}

export function duoProgressSummary(progress: DuoProgress, requiredGames: number) {
  return { ...progress, requiredGames, completedGames: progress.games.length,
    homeScore: progress.games.reduce((sum, game) => sum + game.homeGoals, 0),
    awayScore: progress.games.reduce((sum, game) => sum + game.awayGoals, 0),
    complete: progress.games.length === requiredGames };
}

export function saveDuoGameProgress(tournament: Tournament, home: readonly { userId: string }[], away: readonly { userId: string }[],
  progress: DuoProgress, input: DuoGameScore & { expectedVersion: number }): DuoProgress {
  if (tournament.mode !== 'DUO' || !tournament.duoAggregateEnabled || home.length !== 2 || away.length !== 2) {
    throw new BadRequestException('Individual game saving requires an aggregate Duo fixture with two players on each side.');
  }
  const count = tournament.duoGamesPerFixture === 4 ? 4 : 2;
  const homeIds = new Set(home.map(member => member.userId)), awayIds = new Set(away.map(member => member.userId));
  if (!homeIds.has(input.homePlayerId) || !awayIds.has(input.awayPlayerId) || !goal(input.homeGoals) || !goal(input.awayGoals)) {
    throw new BadRequestException('Choose this fixture’s players and enter whole-number scores from 0 to 99.');
  }
  const existing = progress.games.find(game => game.homePlayerId === input.homePlayerId && game.awayPlayerId === input.awayPlayerId);
  const identical = existing?.homeGoals === input.homeGoals && existing?.awayGoals === input.awayGoals;
  if (input.expectedVersion !== (existing?.version ?? 0) && !identical) {
    throw new ConflictException('This game was updated elsewhere. Reload its saved score before changing it.');
  }
  const games = progress.games.filter(game => game !== existing);
  games.push({ homePlayerId: input.homePlayerId, awayPlayerId: input.awayPlayerId, homeGoals: input.homeGoals, awayGoals: input.awayGoals, version: (existing?.version ?? 0) + 1 });
  if (homeIds.size !== 2 || awayIds.size !== 2 || games.length > count ||
    games.some(game => !homeIds.has(game.homePlayerId) || !awayIds.has(game.awayPlayerId)) ||
    new Set(games.map(game => JSON.stringify([game.homePlayerId, game.awayPlayerId]))).size !== games.length ||
    (count === 2 && (new Set(games.map(game => game.homePlayerId)).size !== games.length || new Set(games.map(game => game.awayPlayerId)).size !== games.length))) {
    throw new BadRequestException(count === 4 ? 'Each player must face each opponent once.' : 'Each player must appear in exactly one game.');
  }
  const summary = duoProgressSummary({ revision: progress.revision, games }, count);
  if (summary.homeScore > 99 || summary.awayScore > 99) throw new BadRequestException('The combined score must be 99 or fewer goals per side.');
  return identical ? progress : { revision: progress.revision + 1, games };
}

export function assertSavedDuoGamesMatch(progress: DuoProgress, games: DuoGameScore[]) {
  if (!progress.games.length) return; // Existing all-at-once clients remain supported.
  const key = (game: DuoGameScore) => JSON.stringify([game.homePlayerId, game.awayPlayerId, game.homeGoals, game.awayGoals]);
  if (progress.games.length !== games.length || progress.games.map(key).sort().join('|') !== games.map(key).sort().join('|')) {
    throw new ConflictException('Save every Duo game and reload the latest scores before submitting the fixture.');
  }
}
