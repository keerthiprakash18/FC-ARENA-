/**
 * UI classification must use actual configured groups, not the legacy
 * groupMode flag alone. A league can retain MULTIPLE_GROUPS from an older
 * setup despite having zero groups and 190 ordinary league fixtures.
 */
const ROUND_ROBIN_LEAGUES = new Set([
  'LEAGUE_ROUND_ROBIN',
  'DOUBLE_ROUND_ROBIN',
  'ROUND_ROBIN',
]);

const KNOCKOUT_FORMATS = new Set([
  'GROUP_STAGE_KNOCKOUT',
  'SINGLE_ELIMINATION',
  'ELITE_CUP',
  'UCL_CUP',
]);

export function isRoundRobinLeague(format: string | null | undefined): boolean {
  return ROUND_ROBIN_LEAGUES.has(format ?? '');
}

export function hasKnockoutStage(format: string | null | undefined): boolean {
  return KNOCKOUT_FORMATS.has(format ?? '');
}

export function isSingleTableDisplay(
  competitionFormat: string | null | undefined,
  groupMode: string | null | undefined,
  actualGroupCount: number,
): boolean {
  return groupMode !== 'MULTIPLE_GROUPS'
    || (isRoundRobinLeague(competitionFormat) && actualGroupCount === 0);
}

export function showReadOnlyGroupRoster(
  groupMode: string | null | undefined,
  actualGroupCount: number,
  canChangeMembership: boolean,
): boolean {
  return groupMode !== 'MULTIPLE_GROUPS'
    || (actualGroupCount === 0 && !canChangeMembership);
}
