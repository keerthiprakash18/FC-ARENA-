import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';

export const bestThirdPlayoffSettings = {
  qualifiersPerGroup: 2,
  playoffQualifiersTotal: 16,
  playoffSource: 'GROUP_QUALIFIERS',
  playoffFormat: 'GLOBAL_SEEDED',
  playoffSeedingBasis: 'RANDOM',
  playoffPairingMethod: 'RANDOM',
  avoidSameGroupEarly: false,
} as const;

export function usesBestThirdPlayoffs(tournament: {
  competitionFormat: string;
  qualifiersPerGroup: number | null;
  playoffQualifiersTotal: number | null;
  playoffSource: string;
  playoffFormat: string;
  playoffSeedingBasis: string;
}) {
  return tournament.competitionFormat === 'GROUP_STAGE_KNOCKOUT' &&
    tournament.qualifiersPerGroup === bestThirdPlayoffSettings.qualifiersPerGroup &&
    tournament.playoffQualifiersTotal === bestThirdPlayoffSettings.playoffQualifiersTotal &&
    tournament.playoffSource === bestThirdPlayoffSettings.playoffSource &&
    tournament.playoffFormat === bestThirdPlayoffSettings.playoffFormat &&
    tournament.playoffSeedingBasis === bestThirdPlayoffSettings.playoffSeedingBasis;
}

export interface GroupResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
}

interface GroupEntry {
  id: string;
  groupId: string | null;
}

interface EntryScore {
  points: number;
  goalDifference: number;
  goalsFor: number;
}

export function compareGroupScores(left: EntryScore, right: EntryScore) {
  return right.points - left.points || right.goalDifference - left.goalDifference || right.goalsFor - left.goalsFor;
}

export function coversSingleRoundRobin(entries: GroupEntry[], fixtures: {
  groupId: string | null;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
}[]) {
  const groups = new Map(entries.map(entry => [entry.id, entry.groupId]));
  const seen = new Set<string>();
  return fixtures.length === 105 && fixtures.every(fixture => {
    const { groupId, homeRegistrationId: home, awayRegistrationId: away } = fixture;
    if (!groupId || !home || !away || home === away || groups.get(home) !== groupId || groups.get(away) !== groupId) return false;
    const key = [home, away].sort().join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupScores(entries: GroupEntry[], results: GroupResult[]) {
  const scores = new Map(entries.map(entry => [entry.id, {
    ...entry, points: 0, goalDifference: 0, goalsFor: 0,
  }]));
  for (const result of results) {
    const home = scores.get(result.homeId);
    const away = scores.get(result.awayId);
    if (!home || !away || home.groupId !== away.groupId) continue;
    const difference = result.homeScore - result.awayScore;
    home.points += difference > 0 ? 3 : difference === 0 ? 1 : 0;
    away.points += difference < 0 ? 3 : difference === 0 ? 1 : 0;
    home.goalDifference += difference;
    away.goalDifference -= difference;
    home.goalsFor += result.homeScore;
    away.goalsFor += result.awayScore;
  }
  return [...scores.values()];
}

/** A stable draw resolves exact ties, so refreshing the standings cannot move a team. */
export function rankBestThirdGroups(
  tournamentId: string,
  entries: GroupEntry[],
  results: GroupResult[],
  fairPlay: ReadonlyMap<string, number>,
) {
  const drawOrder = new Map(entries.map(entry => [
    entry.id, createHash('sha256').update(`${tournamentId}:${entry.id}`).digest('hex'),
  ]));
  const compareDraw = (left: GroupEntry, right: GroupEntry) =>
    drawOrder.get(left.id)!.localeCompare(drawOrder.get(right.id)!);
  const groups = new Map<string, ReturnType<typeof groupScores>>();
  for (const score of groupScores(entries, results).sort(compareGroupScores)) {
    if (!score.groupId) continue;
    const group = groups.get(score.groupId) ?? [];
    group.push(score);
    groups.set(score.groupId, group);
  }

  for (const [id, group] of groups) {
    const ranked: typeof group = [];
    for (let start = 0; start < group.length;) {
      let end = start + 1;
      while (end < group.length && compareGroupScores(group[start], group[end]) === 0) end++;
      const tied = group.slice(start, end);
      const headToHead = new Map(groupScores(tied, results).map(score => [score.id, score]));
      tied.sort((left, right) =>
        compareGroupScores(headToHead.get(left.id)!, headToHead.get(right.id)!) ||
        (fairPlay.get(right.id) ?? 0) - (fairPlay.get(left.id) ?? 0) ||
        compareDraw(left, right));
      ranked.push(...tied);
      start = end;
    }
    groups.set(id, ranked);
  }

  const thirdPlace = [...groups.values()].flatMap(group => group[2] ? [group[2]] : [])
    .sort((left, right) => compareGroupScores(left, right) ||
      (fairPlay.get(right.id) ?? 0) - (fairPlay.get(left.id) ?? 0) ||
      compareDraw(left, right));
  return { groups, thirdPlace };
}

export async function loadGroupFairPlay(
  tx: Prisma.TransactionClient,
  tournament: { leagueId: string; createdAt: Date },
  entries: { id: string; members: { userId: string }[] }[],
) {
  const entriesByUser = new Map(entries.flatMap(entry => entry.members.map(member => [member.userId, entry.id] as const)));
  const events = await tx.fairPlayEvent.findMany({
    where: {
      leagueId: tournament.leagueId,
      userId: { in: [...entriesByUser.keys()] },
      revokedAt: null,
      issuedAt: { gte: tournament.createdAt },
    },
    select: { userId: true, pointsDelta: true },
  });
  const totals = new Map<string, number>();
  for (const event of events) {
    const entryId = entriesByUser.get(event.userId)!;
    totals.set(entryId, (totals.get(entryId) ?? 0) + event.pointsDelta);
  }
  return totals;
}
