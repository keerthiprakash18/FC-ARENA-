import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Two FC Mobile games determine one Duo fixture:
 * home aggregate = home game 1 + home game 2;
 * away aggregate = away game 1 + away game 2.
 * All pairings and scores are persisted and independently verifiable.
 * Legacy Duo tournaments are not migrated to this new rule automatically.
 */
export interface DuoGameScore {
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number;
  awayGoals: number;
}

interface DuoTournament {
  mode: string;
  duoAggregateEnabled: boolean;
}
interface DuoSide { userId: string }
interface DuoTotals { homeScore: number; awayScore: number; duoGames?: unknown }

const isGoal = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 99;

export function parseDuoGames(value: unknown): DuoGameScore[] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const games: DuoGameScore[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    const game = item as Record<string, unknown>;
    if (typeof game.homePlayerId !== 'string' || typeof game.awayPlayerId !== 'string'
      || !isGoal(game.homeGoals) || !isGoal(game.awayGoals)) return undefined;
    games.push({
      homePlayerId: game.homePlayerId,
      awayPlayerId: game.awayPlayerId,
      homeGoals: game.homeGoals,
      awayGoals: game.awayGoals,
    });
  }
  return games;
}

export function validateDuoAggregate(
  tournament: DuoTournament,
  homeMembers: readonly DuoSide[],
  awayMembers: readonly DuoSide[],
  scores: DuoTotals,
): DuoGameScore[] | undefined {
  if (!tournament.duoAggregateEnabled) {
    if (scores.duoGames !== undefined && scores.duoGames !== null) {
      throw new BadRequestException('Individual Duo game scores are not enabled for this tournament.');
    }
    return undefined;
  }
  if (tournament.mode !== 'DUO' || homeMembers.length !== 2 || awayMembers.length !== 2) {
    throw new BadRequestException('An aggregate Duo result requires two players on each team.');
  }
  const games = parseDuoGames(scores.duoGames);
  if (!games) {
    throw new BadRequestException('Enter both Duo games with two valid player pairings and their scores.');
  }
  const home = new Set(homeMembers.map(member => member.userId));
  const away = new Set(awayMembers.map(member => member.userId));
  if (home.size !== 2 || away.size !== 2 ||
    games.some(game => !home.has(game.homePlayerId) || !away.has(game.awayPlayerId)) ||
    new Set(games.map(game => game.homePlayerId)).size !== 2 ||
    new Set(games.map(game => game.awayPlayerId)).size !== 2) {
    throw new BadRequestException('Each Duo player must appear exactly once on their own team side.');
  }
  const homeTotal = games.reduce((sum, game) => sum + game.homeGoals, 0);
  const awayTotal = games.reduce((sum, game) => sum + game.awayGoals, 0);
  if (homeTotal !== scores.homeScore || awayTotal !== scores.awayScore) {
    throw new BadRequestException('Duo team totals must exactly equal the sum of the two individual games.');
  }
  return games;
}

/** Prisma JSON columns accept plain JSON objects; never store a client-calculated winner. */
export function duoGamesJson(games?: DuoGameScore[]): Prisma.InputJsonValue | undefined {
  return games as Prisma.InputJsonValue | undefined;
}
