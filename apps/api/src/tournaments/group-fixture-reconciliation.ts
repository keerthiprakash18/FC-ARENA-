import { BadRequestException, ConflictException } from '@nestjs/common';
import { generateDoubleRoundRobinFixtures, generateRoundRobinFixtures } from './fixture-engine.js';
import { roundRobinRoundsPerLeg } from '../results/standings-integrity.js';

export interface OldGroupFixture {
  id: string;
  fixtureCode: string;
  groupId: string | null;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  phase: string;
  status: string;
  roundNumber: number;
  matchday: number | null;
  roundName?: string;
  bracketPosition?: number;
  scheduledAt?: Date | string | null;
  publishedAt?: Date | string | null;
  nextFixtureId?: string | null;
  loserNextFixtureId?: string | null;
  deadlineCase?: { id: string } | null;
  match?: {
    id: string;
    status: string;
    confirmedResultSubmissionId: string | null;
    homeReadyAt: Date | string | null;
    awayReadyAt: Date | string | null;
    arenaPost?: { id: string } | null;
    _count: { resultSubmissions: number; statEvents: number; ocrExtractions: number; disputes: number; arenaPosts?: number };
  } | null;
}

export interface ReconciledGroupSlot {
  groupId: string;
  roundNumber: number;
  roundName: string;
  matchday: number | null;
  bracketPosition: number;
}
export interface GroupFixtureChanges {
  updates: Array<ReconciledGroupSlot & { id: string }>;
  creates: Array<ReconciledGroupSlot & { homeRegistrationId: string; awayRegistrationId: string }>;
  removeFixtureIds: string[];
}
export interface GroupFixtureReconciliationInput {
  /** Supply affected groups and their fixtures only; unchanged groups stay untouched. */
  groups: Array<{ id: string; name: string; position: number; registrationIds: string[] }>;
  oldGroupSizes: Record<string, number>;
  fixtures: OldGroupFixture[];
  /** Normalize a legacy DOUBLE_ROUND_ROBIN competition to HOME_AWAY here. */
  legType: string;
}

/** Scheduled-only rows can be replaced through the explicit editor preview/apply. */
export function groupFixtureProtectionReason(fixture: OldGroupFixture): string | null {
  if (fixture.phase !== 'STAGE') return 'a downstream playoff fixture';
  if (!['UNSCHEDULED', 'SCHEDULED', 'POSTPONED'].includes(fixture.status)) return `fixture status ${fixture.status}`;
  if (fixture.deadlineCase) return 'a recorded deadline case';
  if (fixture.nextFixtureId || fixture.loserNextFixtureId) return 'fixture progression links';
  const match = fixture.match;
  if (!match) return null;
  if (!['UNSCHEDULED', 'SCHEDULED', 'POSTPONED'].includes(match.status)) return `match status ${match.status}`;
  if (match.confirmedResultSubmissionId) return 'a confirmed result';
  if (match.homeReadyAt || match.awayReadyAt) return 'player readiness';
  if (match.arenaPost) return 'a linked match post';
  const counts = match._count;
  if (!counts || !['resultSubmissions', 'statEvents', 'ocrExtractions', 'disputes'].every(key => Number.isInteger(counts[key as keyof typeof counts]) && counts[key as keyof typeof counts]! >= 0)) return 'unverified match activity';
  if (counts.resultSubmissions) return 'a submitted result';
  if (counts.statEvents) return 'recorded result statistics';
  if (counts.ocrExtractions) return 'an uploaded match proof';
  if (counts.disputes) return 'a match dispute';
  if (counts.arenaPosts) return 'a linked match post';
  return null;
}

export function isGroupFixtureProtected(fixture: OldGroupFixture): boolean {
  return groupFixtureProtectionReason(fixture) !== null;
}
export const isProtectedGroupFixture = isGroupFixtureProtected;

function invalid(message: string): never {
  throw new BadRequestException({ success: false, data: null, error: { code: 'INVALID_GROUP_FIXTURE_PLAN', message } });
}
function protectedConflict(fixture: OldGroupFixture, detail: string, code = 'GROUP_FIXTURE_HAS_ACTIVITY'): never {
  const reason = groupFixtureProtectionReason(fixture);
  throw new ConflictException({ success: false, data: null, error: {
    code,
    message: `${fixture.fixtureCode}: ${detail}${reason ? ` This fixture has ${reason}.` : ''} Existing matches and results were not changed.`,
    fixtureCode: fixture.fixtureCode,
  } });
}
const pairKey = (home: string, away: string) => JSON.stringify([home, away].sort());
const key = (groupId: string, pair: string, leg: number) => JSON.stringify([groupId, pair, leg]);

/**
 * A pure schedule plan. Retained rows are updated only with the returned group/
 * round metadata; their identity, orientation, dates and all match data survive.
 * Fresh engine slots also avoid participant/day collisions and changing the
 * leg boundary when a group changes from (for example) seven to six teams.
 */
export function planGroupFixtureChanges(input: GroupFixtureReconciliationInput): GroupFixtureChanges {
  const { groups, oldGroupSizes, fixtures, legType } = input;
  if (!['SINGLE_LEG', 'HOME_AWAY', 'DOUBLE_LEG'].includes(legType)) invalid('This fixture leg format is not supported for group changes.');
  const double = legType !== 'SINGLE_LEG';
  const groupIds = new Set<string>();
  const destination = new Map<string, string>();
  for (const group of groups) {
    if (!group.id || groupIds.has(group.id)) invalid('Each group must occur once in the fixture plan.');
    if (!group.name.trim()) invalid('Every group requires a name.');
    if (group.registrationIds.length < 2) invalid(`${group.name} needs at least two approved teams before fixtures can be reconciled.`);
    groupIds.add(group.id);
    for (const id of group.registrationIds) {
      if (!id || destination.has(id)) invalid('Each approved team must belong to exactly one group.');
      destination.set(id, group.id);
    }
  }
  if (new Set(fixtures.map(fixture => fixture.id)).size !== fixtures.length) invalid('A fixture occurs more than once in the group change request.');
  if (fixtures.some(fixture => fixture.phase !== 'STAGE')) {
    const fixture = fixtures.find(fixture => fixture.phase !== 'STAGE')!;
    protectedConflict(fixture, 'Group reconciliation cannot replace a playoff or progression fixture.', 'GROUP_PLAYOFFS_REQUIRE_REVIEW');
  }

  const remove = new Set<string>();
  const candidates = new Map<string, OldGroupFixture[]>();
  for (const fixture of fixtures) {
    const home = fixture.homeRegistrationId, away = fixture.awayRegistrationId;
    const target = home ? destination.get(home) : undefined;
    if (!home || !away || home === away || !target || destination.get(away) !== target) {
      if (isGroupFixtureProtected(fixture)) protectedConflict(fixture, 'Keep both teams together in one group, or choose a different team to move.');
      remove.add(fixture.id); continue;
    }
    let leg = 1;
    if (double) {
      const oldSize = fixture.groupId ? oldGroupSizes[fixture.groupId] : undefined;
      const rounds = oldSize && Number.isInteger(oldSize) && oldSize >= 2 ? roundRobinRoundsPerLeg(oldSize) : 0;
      const day = fixture.matchday ?? fixture.roundNumber;
      if (!rounds || !Number.isInteger(day) || day < 1 || day > rounds * 2) {
        if (isGroupFixtureProtected(fixture)) protectedConflict(fixture, 'The original home/away leg cannot be verified. Review its round information before changing groups.', 'GROUP_FIXTURE_LEG_UNCERTAIN');
        remove.add(fixture.id); continue;
      }
      leg = day <= rounds ? 1 : 2;
    }
    const candidateKey = key(target, pairKey(home, away), leg);
    const rows = candidates.get(candidateKey) ?? [];
    rows.push(fixture); candidates.set(candidateKey, rows);
  }

  const selected = new Map<string, OldGroupFixture>();
  for (const [candidateKey, rows] of candidates) {
    const protectedRows = rows.filter(isGroupFixtureProtected);
    if (protectedRows.length > 1) protectedConflict(protectedRows[1], 'More than one recorded fixture occupies the same pairing and leg. Review the duplicate fixtures before changing groups.', 'GROUP_RECORDED_DUPLICATE_FIXTURES');
    const chosen = protectedRows[0] ?? rows.find(row => Boolean(row.publishedAt)) ?? rows[0];
    selected.set(candidateKey, chosen);
    for (const row of rows) if (row !== chosen) remove.add(row.id);
  }

  const updates: GroupFixtureChanges['updates'] = [], creates: GroupFixtureChanges['creates'] = [];
  for (const group of [...groups].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
    const rounds = roundRobinRoundsPerLeg(group.registrationIds.length);
    const blueprints = double ? generateDoubleRoundRobinFixtures(group.registrationIds) : generateRoundRobinFixtures(group.registrationIds);
    const firstOrientation = new Map<string, [string, string]>();
    for (const blueprint of blueprints) {
      const pair = pairKey(blueprint.homeRegistrationId!, blueprint.awayRegistrationId!);
      if (firstOrientation.has(pair)) continue;
      const first = selected.get(key(group.id, pair, 1)), second = selected.get(key(group.id, pair, 2));
      const source = first && isGroupFixtureProtected(first) ? first : second && isGroupFixtureProtected(second) ? second : first ?? second;
      const orientation: [string, string] = source
        ? source === second ? [source.awayRegistrationId!, source.homeRegistrationId!] : [source.homeRegistrationId!, source.awayRegistrationId!]
        : [blueprint.homeRegistrationId!, blueprint.awayRegistrationId!];
      firstOrientation.set(pair, orientation);
    }
    for (const blueprint of blueprints) {
      const pair = pairKey(blueprint.homeRegistrationId!, blueprint.awayRegistrationId!);
      const leg = double && blueprint.matchday! > rounds ? 2 : 1;
      const first = firstOrientation.get(pair)!;
      const [home, away] = leg === 1 ? first : [first[1], first[0]];
      const existing = selected.get(key(group.id, pair, leg));
      const slot: ReconciledGroupSlot = { groupId: group.id, roundNumber: blueprint.roundNumber, roundName: `${group.name} - ${blueprint.roundName}`, matchday: blueprint.matchday, bracketPosition: blueprint.bracketPosition };
      if (existing && existing.homeRegistrationId === home && existing.awayRegistrationId === away) {
        updates.push({ id: existing.id, ...slot });
      } else {
        if (existing && isGroupFixtureProtected(existing)) protectedConflict(existing, 'Recorded home/away directions do not form a valid return-leg pair. Review these fixtures before changing groups.', 'GROUP_FIXTURE_DIRECTION_CONFLICT');
        if (existing) remove.add(existing.id);
        creates.push({ ...slot, homeRegistrationId: home, awayRegistrationId: away });
      }
    }
  }
  // An accidental planner omission must never turn into a cascading data delete.
  const kept = new Set(updates.map(row => row.id));
  for (const fixture of fixtures) if (isGroupFixtureProtected(fixture) && !kept.has(fixture.id)) protectedConflict(fixture, 'This recorded fixture cannot be retained in the requested group schedule.');
  return { updates, creates, removeFixtureIds: [...remove] };
}
