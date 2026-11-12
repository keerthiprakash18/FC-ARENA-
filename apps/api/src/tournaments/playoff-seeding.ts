export interface PlayoffSeedGroup {
  id: string;
  position: number;
  qualifiers: Array<{ id: string }>;
}

export interface PlayoffSeedPlan {
  seedOrder: string[];
  bracketSlots: Array<string | null>;
  bracketSize: number;
  byeCount: number;
  playInMatches: number;
}

function nextPowerOfTwo(value: number) {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

export function buildPlayoffSeedPlan(
  groups: PlayoffSeedGroup[],
): PlayoffSeedPlan {
  const orderedGroups = [...groups].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );

  const maxRank = Math.max(
    0,
    ...orderedGroups.map((group) => group.qualifiers.length),
  );

  const rankedSeeds: Array<{
    id: string;
    groupId: string;
    rank: number;
  }> = [];

  for (let rank = 0; rank < maxRank; rank++) {
    for (const group of orderedGroups) {
      const qualifier = group.qualifiers[rank];
      if (qualifier) {
        rankedSeeds.push({
          id: qualifier.id,
          groupId: group.id,
          rank,
        });
      }
    }
  }

  const unique = new Set(rankedSeeds.map((seed) => seed.id));
  if (unique.size !== rankedSeeds.length) {
    throw new Error('Duplicate playoff qualifier detected.');
  }

  const totalQualifiers = rankedSeeds.length;
  if (totalQualifiers < 2) {
    throw new Error('At least two playoff qualifiers are required.');
  }
  const bracketSize = nextPowerOfTwo(totalQualifiers);
  const byeCount = bracketSize - totalQualifiers;
  const byeSeeds = rankedSeeds.slice(0, byeCount);
  const remaining = rankedSeeds.slice(byeCount);
  if (remaining.length % 2 !== 0) {
    throw new Error('Invalid playoff play-in participant count.');
  }

  const seedOrder = byeSeeds.map((seed) => seed.id);

  for (let index = 0; index < remaining.length / 2; index++) {
    const highSeed = remaining[index];
    const lowSeed = remaining[remaining.length - 1 - index];

    if (!highSeed || !lowSeed) {
      throw new Error('Invalid playoff seed pairing.');
    }

    seedOrder.push(highSeed.id, lowSeed.id);
  }

  // Place the strongest branches in separate halves/quarters. A missing
  // opponent is an explicit bye, not a fixture that needs a result.
  let branchSeeds = [1];
  for (let size = 2; size <= bracketSize / 2; size *= 2) {
    branchSeeds = branchSeeds.flatMap((seed) => [seed, size + 1 - seed]);
  }
  const bracketSlots = branchSeeds.flatMap((seed) => [
    rankedSeeds[seed - 1].id,
    rankedSeeds[bracketSize - seed]?.id ?? null,
  ]);

  return {
    seedOrder,
    bracketSlots,
    bracketSize,
    byeCount,
    playInMatches: byeCount > 0 ? remaining.length / 2 : 0,
  };
}

/**
 * Keep each upper seed in its protected bracket branch while reassigning
 * lower opponents if extra cross-group qualifiers create a first-round
 * rematch (e.g. 7 x top-2 + 2 best third-place).
 *
 * Existing byes are untouched. Any unsatisfiable constraint blocks fixture
 * generation instead of silently pairing same-group participants.
 */
export function separateOpeningGroupRematches(
  slots: ReadonlyArray<string | null>,
  groups: ReadonlyArray<PlayoffSeedGroup>,
): Array<string | null> {
  if (slots.length % 2 !== 0) {
    throw new Error('Invalid bracket slot count.');
  }
  const membership = new Map<string, string>();
  for (const group of groups) {
    for (const entrant of group.qualifiers) {
      if (membership.has(entrant.id)) throw new Error('Duplicate group qualifier detected.');
      membership.set(entrant.id, group.id);
    }
  }

  const active = Array.from({ length: slots.length / 2 }, (_, pair) => pair)
    .filter(pair => slots[2 * pair] !== null && slots[2 * pair + 1] !== null);
  const upper = active.map(pair => slots[2 * pair]!);
  const lower = active.map(pair => slots[2 * pair + 1]!);

  for (const id of [...upper, ...lower]) {
    if (!membership.has(id)) throw new Error('Bracket qualifier has no group.');
  }

  if (upper.every((id, index) => membership.get(id) !== membership.get(lower[index]))) {
    return [...slots];
  }

  const assignedLowerToUpper = Array(lower.length).fill(-1);
  function assign(upperIndex: number, seen: Set<number>): boolean {
    for (let offset = 0; offset < lower.length; offset++) {
      const lowerIndex = (upperIndex + offset) % lower.length;
      if (
        seen.has(lowerIndex) ||
        membership.get(upper[upperIndex]) === membership.get(lower[lowerIndex])
      ) continue;
      seen.add(lowerIndex);
      const previous = assignedLowerToUpper[lowerIndex];
      if (previous === -1 || assign(previous, seen)) {
        assignedLowerToUpper[lowerIndex] = upperIndex;
        return true;
      }
    }
    return false;
  }

  for (let upperIndex = 0; upperIndex < upper.length; upperIndex++) {
    if (!assign(upperIndex, new Set())) {
      throw new Error('Unable to avoid a first-round rematch between group opponents.');
    }
  }

  const result = [...slots];
  for (let lowerIndex = 0; lowerIndex < lower.length; lowerIndex++) {
    const target = assignedLowerToUpper[lowerIndex];
    result[2 * active[target] + 1] = lower[lowerIndex];
  }
  return result;
}
