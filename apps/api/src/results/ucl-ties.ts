import { BadRequestException, ConflictException } from '@nestjs/common';

interface Fixture {
  id: string;
  tournamentId: string;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  phase: string;
  matchday: number | null;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
}
interface Score {
  homeScore: number;
  awayScore: number;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
}

export function isUclLeg(fixture: Pick<Fixture, 'roundName' | 'phase' | 'matchday'>) {
  return fixture.phase === 'PLAYOFF' && fixture.roundName?.startsWith('UCL ') && [1, 2].includes(fixture.matchday!);
}

/** Use the same verified predecessor for uploads, match-room state and aggregation. */
export async function getUclReturnLegAccess(tx: any, fixture: Fixture) {
  if (!isUclLeg(fixture) || fixture.matchday !== 2) return null;
  const first = await tx.fixture.findFirst({
    where: { tournamentId: fixture.tournamentId, phase: 'PLAYOFF', roundNumber: fixture.roundNumber, bracketPosition: fixture.bracketPosition, matchday: 1 },
    include: { match: { include: { confirmedResult: true } } },
  });
  const verified = Boolean(first && first.status === 'COMPLETED' && first.match?.status === 'COMPLETED' &&
    first.match?.confirmedResult?.status === 'CONFIRMED' &&
    fixture.homeRegistrationId && fixture.awayRegistrationId &&
    first.homeRegistrationId === fixture.awayRegistrationId && first.awayRegistrationId === fixture.homeRegistrationId);
  return {
    canUpload: verified,
    firstLegMatchId: first?.match?.id ?? null,
    firstLegFixtureCode: first?.fixtureCode ?? null,
    // Scores are oriented to the current (return-leg) home and away sides.
    firstLegScore: verified ? { homeScore: first.match.confirmedResult.awayScore as number, awayScore: first.match.confirmedResult.homeScore as number } : null,
    message: verified ? null : 'Upload and verify the first-leg result before uploading or submitting the second-leg result.',
  };
}

export async function assertUclReturnLegReady(tx: any, fixture: Fixture) {
  const access = await getUclReturnLegAccess(tx, fixture);
  if (access && !access.canUpload) invalid('FIRST_LEG_NOT_CONFIRMED', access.message!);
  return access;
}

function invalid(code: string, message: string): never {
  throw new BadRequestException({ success: false, data: null, error: { code, message } });
}

export function resolveAggregateWinner(home: string, away: string, score: Score, firstLeg?: Score | null) {
  // Return-leg teams are reversed. Away goals never break an aggregate tie.
  const homeTotal = score.homeScore + (firstLeg?.awayScore ?? 0);
  const awayTotal = score.awayScore + (firstLeg?.homeScore ?? 0);
  const hasPenalties = score.homePenaltyScore != null || score.awayPenaltyScore != null;
  if (homeTotal !== awayTotal) {
    if (hasPenalties) invalid('PENALTIES_NOT_REQUIRED', 'Only enter penalties when the final or aggregate score is tied.');
    return homeTotal > awayTotal ? home : away;
  }
  if (score.homePenaltyScore == null || score.awayPenaltyScore == null ||
    !Number.isInteger(score.homePenaltyScore) || !Number.isInteger(score.awayPenaltyScore) ||
    score.homePenaltyScore < 0 || score.awayPenaltyScore < 0 ||
    score.homePenaltyScore > 99 || score.awayPenaltyScore > 99 ||
    score.homePenaltyScore === score.awayPenaltyScore) {
    invalid('PENALTY_WINNER_REQUIRED', 'Scores are tied. Enter both penalty shoot-out scores with a winning side.');
  }
  return score.homePenaltyScore > score.awayPenaltyScore ? home : away;
}

export async function uclWinner(tx: any, fixture: Fixture, score: Score): Promise<string | null> {
  if (isUclLeg(fixture) && fixture.matchday === 1) {
    if (score.homePenaltyScore != null || score.awayPenaltyScore != null) invalid('FIRST_LEG_PENALTIES_NOT_ALLOWED', 'A first leg can finish as a draw. Do not enter penalties.');
    return null;
  }
  let firstLeg: Score | null = null;
  if (isUclLeg(fixture) && fixture.matchday === 2) {
    const access = await assertUclReturnLegReady(tx, fixture);
    firstLeg = { homeScore: access!.firstLegScore!.awayScore, awayScore: access!.firstLegScore!.homeScore };
  }
  if (!fixture.homeRegistrationId || !fixture.awayRegistrationId) invalid('MATCH_PARTICIPANTS_NOT_READY', 'Both participants must be resolved.');
  return resolveAggregateWinner(fixture.homeRegistrationId, fixture.awayRegistrationId, score, firstLeg);
}

export async function assertUclFirstLegMutable(tx: any, fixture: Fixture) {
  if (!isUclLeg(fixture) || fixture.matchday !== 1) return;
  const second = await tx.fixture.findFirst({
    where: { tournamentId: fixture.tournamentId, phase: 'PLAYOFF', roundNumber: fixture.roundNumber, bracketPosition: fixture.bracketPosition, matchday: 2 },
    include: { match: true },
  });
  if (second?.match && (second.match.confirmedResultSubmissionId ||
    !['UNSCHEDULED', 'SCHEDULED'].includes(second.match.status))) {
    throw new ConflictException({ success: false, data: null, error: {
      code: 'UCL_RETURN_LEG_STARTED', message: 'Reverse the return-leg result and clear its match state before changing the first leg.',
    } });
  }
}

/** A winner enters both legs of the next tie with reversed home/away slots. */
export async function mirrorUclReturnLeg(tx: any, target: Fixture, slot: 'HOME' | 'AWAY', registrationId: string | null) {
  if (!isUclLeg(target) || target.matchday !== 1) return;
  const second = await tx.fixture.findFirst({
    where: { tournamentId: target.tournamentId, phase: 'PLAYOFF', roundNumber: target.roundNumber, bracketPosition: target.bracketPosition, matchday: 2 },
    include: { match: true },
  });
  if (!second) throw new ConflictException({ success: false, data: null, error: { code: 'UCL_RETURN_LEG_MISSING', message: 'The next tie is missing its return leg.' } });
  if (second.match?.confirmedResultSubmissionId || second.match?.homeReadyAt || second.match?.awayReadyAt ||
    (second.match && !['UNSCHEDULED', 'SCHEDULED'].includes(second.match.status))) {
    throw new ConflictException({ success: false, data: null, error: { code: 'DOWNSTREAM_MATCH_LOCKED', message: 'The downstream return leg has already started.' } });
  }
  await tx.fixture.update({ where: { id: second.id }, data: slot === 'HOME' ? { awayRegistrationId: registrationId } : { homeRegistrationId: registrationId } });
}
