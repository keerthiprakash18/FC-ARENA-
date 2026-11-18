/**
 * Sample seed pairings for the illustration only; actual teams and fixtures
 * always come from the persisted universal playoff engine.
 */
export function seededOpeningPairs(count: number): Array<[number, number]> {
  if (![4, 8, 16].includes(count)) return [];
  let branches = [1];
  for (let size = 2; size <= count / 2; size *= 2) {
    branches = branches.flatMap(seed => [seed, size + 1 - seed]);
  }
  return branches.map(seed => [seed, count + 1 - seed]);
}
