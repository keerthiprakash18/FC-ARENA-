export type EliteCupFormat =
  | 'KNOCKOUT'
  | 'ROUND_ROBIN'
  | 'ELITE_CUP'
  | 'UCL_CUP';

export interface EliteCupFormatDefinition {
  label: string;
  shortLabel: string;
  description: string;
  rangeLabel: string;
}

export const ELITE_CUP_KNOCKOUT_TEAM_LIMIT = 8;

export const ELITE_CUP_FORMATS: Record<
  EliteCupFormat,
  EliteCupFormatDefinition
> = {
  KNOCKOUT: {
    label: 'League Phase + Compact Playoff',
    shortLabel: 'Compact Playoff',
    description: 'A compact approved field plays the dynamic league phase before the top four enter playoffs.',
    rangeLabel: `Best for ${ELITE_CUP_KNOCKOUT_TEAM_LIMIT} teams or fewer`,
  },
  ROUND_ROBIN: {
    label: 'League Phase + Elite Playoff',
    shortLabel: 'League Phase',
    description: 'A single combined league table feeds the dynamic Elite Cup playoff field.',
    rangeLabel: `Best for more than ${ELITE_CUP_KNOCKOUT_TEAM_LIMIT} teams`,
  },
  ELITE_CUP: {
    label: 'Elite Cup Dynamic Format',
    shortLabel: 'Elite Cup',
    description: 'The approved team count controls the league-phase schedule and playoff field.',
    rangeLabel: 'Saved Elite Cup configuration',
  },
  UCL_CUP: {
    label: 'UCL Cup League Phase + Playoff',
    shortLabel: 'UCL Cup',
    description: 'The approved field plays a partial league phase before the top-ranked teams enter the UCL Cup playoff bracket.',
    rangeLabel: 'Saved UCL Cup configuration',
  },
};

function approvedTeamCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function getEliteCupRecommendedFormat(
  approvedTeams: number,
): EliteCupFormat {
  return approvedTeamCount(approvedTeams) <= ELITE_CUP_KNOCKOUT_TEAM_LIMIT
    ? 'KNOCKOUT'
    : 'ROUND_ROBIN';
}

export const getRecommendedEliteCupFormat = getEliteCupRecommendedFormat;

export function getEliteCupPlayoffQualifierCount(approvedTeams: number): number {
  const count = approvedTeamCount(approvedTeams);
  if (count <= 3) return count;

  let result = 1;
  while (result * 2 <= count) result *= 2;
  return Math.min(16, result);
}

export function getEliteCupFormatDefinition(
  format: EliteCupFormat,
): EliteCupFormatDefinition {
  return ELITE_CUP_FORMATS[format];
}

export function normalizeEliteCupFormat(
  value: string | null | undefined,
): EliteCupFormat | null {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'ELITE_CUP') {
    return 'ELITE_CUP';
  }

  if (normalized === 'UCL_CUP') {
    return 'UCL_CUP';
  }

  if (normalized === 'KNOCKOUT' || normalized === 'SINGLE_ELIMINATION') {
    return 'KNOCKOUT';
  }

  if (normalized === 'ROUND_ROBIN' || normalized === 'LEAGUE_ROUND_ROBIN') {
    return 'ROUND_ROBIN';
  }

  return null;
}

export function savedEliteCupFormatMatchesRecommendation(
  savedFormat: string | null | undefined,
  approvedTeams: number,
): boolean {
  const normalized = normalizeEliteCupFormat(savedFormat);

  return (
    normalized !== null &&
    (normalized === 'ELITE_CUP' ||
      normalized === 'UCL_CUP' ||
      normalized === getEliteCupRecommendedFormat(approvedTeams))
  );
}

export function getEliteCupRecommendationMessage(
  approvedTeams: number,
): string {
  const count = approvedTeamCount(approvedTeams);

  if (count <= ELITE_CUP_KNOCKOUT_TEAM_LIMIT) {
    return `With ${count} approved ${count === 1 ? 'team' : 'teams'}, the Elite Cup uses a league phase followed by a compact playoff bracket.`;
  }

  return `With ${count} approved teams, the Elite Cup uses one combined league phase and a dynamic playoff field.`;
}
