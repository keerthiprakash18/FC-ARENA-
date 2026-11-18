/**
 * One authoritative completion policy: an event with a knockout phase
 * cannot award its champion from the league table, even when it has
 * zero groups (an existing 20-team round-robin converted to playoffs).
 */
export function requiresPublishedPlayoffStage(
  tournament: { competitionFormat: string },
  actualGroupCount: number,
): boolean {
  return actualGroupCount > 0 ||
    tournament.competitionFormat === 'GROUP_STAGE_KNOCKOUT' ||
    tournament.competitionFormat === 'ELITE_CUP' ||
    tournament.competitionFormat === 'UCL_CUP';
}

export function completionPlacementPolicy(
  tournament: { competitionFormat: string; format: string },
  actualGroupCount: number,
  publishedPlayoffFixtures: number,
): { source: 'KNOCKOUT' | 'LEAGUE'; filterToPlayoffs: boolean; errorCode: string | null } {
  const stagedKnockout = requiresPublishedPlayoffStage(tournament, actualGroupCount);
  const directKnockout = tournament.competitionFormat === 'SINGLE_ELIMINATION' ||
    tournament.format === 'KNOCKOUT';
  return {
    source: stagedKnockout || directKnockout ? 'KNOCKOUT' : 'LEAGUE',
    // Direct knockout fixture previews may historically carry phase STAGE.
    // For a league+playoffs or group+playoffs, only PLAYOFF phase can decide
    // champion: STAGE fixtures have groupId=null in a single-table league.
    filterToPlayoffs: stagedKnockout,
    errorCode: stagedKnockout && publishedPlayoffFixtures === 0
      ? 'PLAYOFF_STAGE_REQUIRED'
      : null,
  };
}
