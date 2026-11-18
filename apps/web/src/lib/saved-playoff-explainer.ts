/** Honest explainer for SAVED tournament rules, not a fabricated live draw.
 * The API universal-playoff-engine determines actual fixtures and winners.
 */
export interface PlayoffGuideInput {
  competitionFormat?: string | null;
  playoffSource?: string | null;
  playoffFormat?: string | null;
  playoffQualifiersTotal?: number | null;
  qualifiersPerGroup?: number | null;
  groupCount?: number | null;
  approvedEntries?: number | null;
  playoffSeedingBasis?: string | null;
}
export interface PlayoffGuide {
  qualifierRule: string;
  selection: string;
  rounds: string[];
  openingExample: string | null;
  knockoutFixtureCount: number | null;
  formatName: string;
  mechanism: string;
  winnerRule: string;
  reminder: string;
  isLeaguePlayoffs: boolean;
}
const nameByFormat: Record<string, string> = {
  GLOBAL_SEEDED: 'Global Seeded Knockout',
  PROTECTED_SEED: 'Protected Seed Knockout',
  DOUBLE_CHANCE: 'Double-Chance Playoffs',
};
export function describeSavedPlayoffs(t: PlayoffGuideInput): PlayoffGuide {
  const competition = t.competitionFormat ?? '';
  const source = t.playoffSource ?? 'AUTO';
  const league = competition === 'GROUP_STAGE_KNOCKOUT' && source === 'OVERALL_STANDINGS';
  const count = t.playoffQualifiersTotal;
  const format = t.playoffFormat ?? '';
  const isDoubleChance = format === 'DOUBLE_CHANCE';
  const isUcl = competition === 'UCL_CUP';
  const isDirect = competition === 'SINGLE_ELIMINATION';
  const isBestThird = source === 'GROUP_QUALIFIERS' && t.groupCount === 7 &&
    t.qualifiersPerGroup === 2 && count === 16 && t.playoffSeedingBasis === 'RANDOM';
  const qualifierRule = isDirect
    ? 'All approved entries enter the knockout draw.'
    : isUcl
      ? 'UCL league-phase qualification follows the saved ranking bands and knockout regulations, including applicable two-leg ties.'
    : isBestThird
      ? 'The top 2 teams from each of 7 groups plus the best 2 third-place teams qualify for the Round of 16.'
    : source === 'GROUP_QUALIFIERS'
      ? `Teams advance from their groups${t.qualifiersPerGroup ? ` (top ${t.qualifiersPerGroup} from each group)` : ''}, subject to saved qualification rules.`
      : source === 'OVERALL_STANDINGS' || league
        ? `After every league-stage match is verified, the top ${count ?? 'configured'} entries in the final overall standings qualify.`
        : 'Qualifiers are selected from the saved tournament qualification rules.';
  let rounds: string[] = [];
  if (!isDoubleChance && count === 4) rounds = ['Semi-finals (4 teams)', 'Final (2 teams)', 'Champion'];
  if (!isDoubleChance && count === 8) rounds = ['Quarter-finals (8 teams)', 'Semi-finals (4 teams)', 'Final (2 teams)', 'Champion'];
  if (!isDoubleChance && count === 16) rounds = ['Round of 16 (16 teams)', 'Quarter-finals (8 teams)', 'Semi-finals (4 teams)', 'Final (2 teams)', 'Champion'];
  if (isDoubleChance) rounds = [
    'Lower-seed elimination path + top-seed qualifying finals',
    'Second Chance: qualifying-final losers face lower-path survivors',
    ...(count !== null && count !== undefined && count >= 8 ? ['Semi-finals'] : []),
    'Final',
    'Champion',
  ];
  if (isUcl) rounds = ['Knockout qualification as applicable', 'Two-leg knockout ties (except final)', 'Single-match final', 'Champion'];
  const openingExample =
    !isUcl && !isDoubleChance && source === 'OVERALL_STANDINGS' &&
    (t.playoffSeedingBasis === 'OVERALL_PERFORMANCE' || t.playoffSeedingBasis === 'AUTO' || !t.playoffSeedingBasis)
      ? count === 4
        ? 'Opening pairings by final league seed: #1 vs #4 and #2 vs #3.'
        : count === 8
          ? 'Example opening quarter-finals: #1 vs #8, #4 vs #5, #2 vs #7, #3 vs #6.'
          : count === 16
            ? 'Opening round pairs high seeds with low seeds from the final top 16.'
            : null
      : null;
  const knockoutFixtureCount = !isUcl && !isDoubleChance && [4, 8, 16].includes(count ?? -1)
    ? (count as number) - 1
    : null;
  const formatName = isUcl ? 'UCL Two-Leg Knockout' : nameByFormat[format] ?? 'Saved Knockout Format';
  const mechanism = isUcl
    ? 'Follow the published two-leg ties and aggregate result rules. The final is a single match.'
    : isDoubleChance
      ? `This is a partial second-chance format, not full double elimination. ${count !== null && count !== undefined && count >= 8 ? 'The top 4' : 'The top 2'} seeded teams enter qualifying finals; a loss there moves them into a Second Chance match. A loss in the lower path eliminates the team.`
      : format === 'PROTECTED_SEED'
        ? 'The best ranked seeds receive seeded bracket placement. With one overall league table, the bracket is the same standard seeded knockout as Global Seeded; extra group-winner separation applies only when multiple groups exist. One loss eliminates a team.'
        : 'Entries are ordered by saved seeding rules into a seeded knockout bracket (for overall performance, strongest plays weakest in the opening round). One loss eliminates a team.';
  return {
    qualifierRule,
    selection: source === 'OVERALL_STANDINGS'
      ? 'Current table positions are provisional until the league stage is complete and results are verified.'
      : 'The published bracket and official saved qualification settings decide the actual participants.',
    rounds,
    openingExample,
    knockoutFixtureCount,
    formatName,
    mechanism,
    winnerRule: isDirect
      ? 'The winner of the verified knockout final is the tournament champion.'
      : 'League first place is NOT automatically champion: the verified knockout final winner is champion.',
    reminder: 'This is a format explanation, not a live fixture draw. The actual teams, opponents and any byes appear only after the bracket is generated.',
    isLeaguePlayoffs: league,
  };
}
