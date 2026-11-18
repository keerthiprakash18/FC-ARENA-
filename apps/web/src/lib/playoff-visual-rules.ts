/**
 * UI-only language for the SAVED tournament qualification rules.
 * This is not a ranking service and never decides who qualifies.
 * The backend fixture engine remains the sole source of official outcomes.
 */
export interface PlayoffVisualRulesInput {
  competitionFormat?: string | null;
  playoffSource?: string | null;
  playoffQualifiersTotal?: number | null;
  qualifiersPerGroup?: number | null;
  playoffSeedingBasis?: string | null;
  groupCount?: number | null;
}

export interface PlayoffVisualRules {
  stageTitle: string;
  stageDetail: string;
  qualificationTitle: string;
  qualificationDetail: string;
  qualificationNote: string;
  seededExamplesAllowed: boolean;
}

export function describePlayoffVisualRules(t: PlayoffVisualRulesInput): PlayoffVisualRules {
  const competition = t.competitionFormat ?? '';
  const source = t.playoffSource ?? 'AUTO';
  const count = t.playoffQualifiersTotal;
  const groups = t.groupCount;
  const perGroup = t.qualifiersPerGroup;
  const isUcl = competition === 'UCL_CUP';

  if (competition === 'SINGLE_ELIMINATION') {
    return {
      stageTitle: 'Approved entries',
      stageDetail: 'No league stage',
      qualificationTitle: 'Direct knockout draw',
      qualificationDetail: 'All approved entrants',
      qualificationNote: 'Actual entry order and byes appear only after the bracket is generated.',
      seededExamplesAllowed: false,
    };
  }

  if (isUcl) {
    return {
      stageTitle: 'UCL league phase',
      stageDetail: 'Verify the league phase',
      qualificationTitle: 'UCL knockout qualification',
      qualificationDetail: 'Saved UCL ranking bands & knockout rules',
      qualificationNote: 'Follow UCL qualification bands and published two-leg ties. A simple Top N knockout illustration would be misleading.',
      seededExamplesAllowed: false,
    };
  }

  if (source === 'GROUP_QUALIFIERS') {
    const isBestThird = groups === 7 && perGroup === 2 && count === 16 &&
      t.playoffSeedingBasis === 'RANDOM';
    if (isBestThird) {
      return {
        stageTitle: '7 group tables',
        stageDetail: 'All group results verified',
        qualificationTitle: '14 + 2 = 16 teams',
        qualificationDetail: 'Top 2 per group + best 2 third-place teams',
        qualificationNote: 'The two best third-place teams are ranked by the saved tie-break rules; the official draw is random.',
        seededExamplesAllowed: false,
      };
    }
    return {
      stageTitle: groups && groups > 1 ? `${groups} group tables` : 'Group tables',
      stageDetail: 'Verified group results',
      qualificationTitle: perGroup ? `Top ${perGroup} per group` : 'Group qualifiers',
      qualificationDetail: count ? `${count} total qualifiers under saved rules` : 'Subject to saved qualification rules',
      qualificationNote: 'Group positions and saved tie-breakers determine who qualifies; do not interpret this as the top teams from one overall table.',
      seededExamplesAllowed: false,
    };
  }

  if (source === 'OVERALL_STANDINGS') {
    return {
      stageTitle: 'Overall league table',
      stageDetail: 'Every stage result verified',
      qualificationTitle: count ? `Top ${count} overall` : 'Configured qualifiers',
      qualificationDetail: 'Final overall ranking, not provisional table',
      qualificationNote: 'Final verified ranking determines the seeds; the league leader does not automatically win the championship.',
      seededExamplesAllowed: t.playoffSeedingBasis === 'OVERALL_PERFORMANCE' ||
        t.playoffSeedingBasis === 'AUTO' || !t.playoffSeedingBasis,
    };
  }

  return {
    stageTitle: 'Tournament stage',
    stageDetail: 'Follow saved fixture rules',
    qualificationTitle: 'Saved qualification rules',
    qualificationDetail: count ? `${count} configured qualifiers` : 'See official qualification settings',
    qualificationNote: 'The format may use group placement or manual seeding; never assume an overall Top N or seeded pairing.',
    seededExamplesAllowed: false,
  };
}
