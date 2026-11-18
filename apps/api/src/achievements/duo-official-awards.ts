import { calculatePerformanceRatings, tiedGoldenBootWinners, tiedGoldenGloveWinners, type AwardMetricRow } from './award-scoring.js';

/**
 * Official individual awards for an aggregate DUO tournament are possible
 * only from confirmed per-player games. Never infer personal goals from
 * team aggregate scores. Only approved team members can receive an honour.
 *
 * A player needs three verified games for the overall 100-point rating.
 * Golden Boot is based on goals; Golden Glove requires a real clean sheet.
 */
export function officialDuoIndividualAwards(
  verifiedMetrics: readonly AwardMetricRow[],
  approvedPlayerIds: ReadonlySet<string>,
) {
  const metrics = verifiedMetrics.filter(row =>
    approvedPlayerIds.has(row.userId) && Number.isInteger(row.matches) && row.matches > 0,
  );
  const goldenBoot = tiedGoldenBootWinners(metrics);
  const goldenGlove = tiedGoldenGloveWinners(metrics.filter(row => row.cleanSheets > 0));
  const playerOfTournament = calculatePerformanceRatings(
    metrics.filter(row => row.matches >= 3),
  )[0] ?? null;
  return { goldenBoot, goldenGlove, playerOfTournament };
}
