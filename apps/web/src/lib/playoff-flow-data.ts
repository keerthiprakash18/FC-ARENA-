/**
 * Sample seed pairings for the illustration only; actual teams and fixtures
 * always come from the persisted universal playoff engine.
 */
export function seededOpeningPairs(count: number): Array<[number, number]> {
  if (![4, 8, 12, 16].includes(count)) return [];
  const bracketSize = 2 ** Math.ceil(Math.log2(count));
  let branches = [1];
  for (let size = 2; size <= bracketSize / 2; size *= 2) {
    branches = branches.flatMap(seed => [seed, size + 1 - seed]);
  }
  return branches.map(seed => [seed, bracketSize + 1 - seed] as [number, number]).filter(([a,b]) => a <= count && b <= count);
}

/** Seed-only example of the knockout route. Never treated as a fixture draw. */
export interface SampleBracketRound {
  title: string;
  matches: string[];
  byes?: number[];
}

export function sampleSeededKnockoutRounds(count: number): SampleBracketRound[] {
  if (![4, 8, 12, 16].includes(count)) return [];
  const pairings = seededOpeningPairs(count);
  if (count === 12) return [
    { title: 'Play-in (8 teams)', matches: pairings.map(([a,b],i) => `PI${i + 1}: #${a} vs #${b}`), byes: [1,2,3,4] },
    { title: 'Quarter-finals', matches: ['QF1: #1 vs winner PI1', 'QF2: #4 vs winner PI2', 'QF3: #2 vs winner PI3', 'QF4: #3 vs winner PI4'] },
    { title: 'Semi-finals', matches: ['SF1: winner QF1 vs winner QF2', 'SF2: winner QF3 vs winner QF4'] },
    { title: 'Final', matches: ['F1: winner SF1 vs winner SF2'] },
  ];
  const opening = count === 16 ? 'R16' : count === 8 ? 'QF' : 'SF';
  const names = count === 16 ? ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'] :
    count === 8 ? ['Quarter-finals', 'Semi-finals', 'Final'] :
    ['Semi-finals', 'Final'];
  const prefixes = count === 16 ? ['R16', 'QF', 'SF', 'F'] :
    count === 8 ? ['QF', 'SF', 'F'] : ['SF', 'F'];
  const matchCode = (prefix: string, index: number) =>
    prefix === 'R16' ? `R16-${index}` : `${prefix}${index}`;
  const rounds: SampleBracketRound[] = [{
    title: names[0]!,
    matches: pairings.map(([a,b], index) => `${matchCode(opening, index + 1)}: #${a} vs #${b}`),
  }];
  let previous = opening;
  let matchCount = pairings.length;
  for (let step = 1; step < names.length; step++) {
    const current = prefixes[step]!;
    const nextCount = matchCount / 2;
    rounds.push({
      title: names[step]!,
      matches: Array.from({ length: nextCount }, (_, index) =>
        `${matchCode(current, index + 1)}: winner ${matchCode(previous, index * 2 + 1)} vs winner ${matchCode(previous, index * 2 + 2)}`),
    });
    previous = current;
    matchCount = nextCount;
  }
  return rounds;
}
