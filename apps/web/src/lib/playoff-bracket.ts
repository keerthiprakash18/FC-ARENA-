import type { FixtureForUi, FixtureEntryForUi } from '../components/tournaments/fixture-card';

export interface BracketTie {
  id: string;
  label: string;
  round: number;
  position: number;
  fixtures: FixtureForUi[];
  home: FixtureEntryForUi | null;
  away: FixtureEntryForUi | null;
  homeSource: FixtureForUi['homeSource'];
  awaySource: FixtureForUi['awaySource'];
  score: { home: number; away: number } | null;
  penalties: { home: number; away: number } | null;
  winnerId: string | null;
  complete: boolean;
  twoLegged: boolean;
  locked: boolean;
}

export interface BracketEdge { from: string; to: string; outcome: 'WINNER' | 'LOSER'; slot: 'HOME' | 'AWAY' }
export interface BracketNode extends BracketTie { x: number; y: number; side: 'left' | 'right' | 'center' }
export const BRACKET_CARD = { width: 228, height: 154, columnGap: 64, rowGap: 34 };

export function bracketEntryName(entry: FixtureEntryForUi | null, source?: FixtureForUi['homeSource']) {
  return entry?.entryName || entry?.members.map(member => member.inGameName || member.fullName).filter(Boolean).join(' + ') ||
    (source ? `${source.outcome === 'LOSER' ? 'Loser' : 'Winner'} of ${source.fixtureCode}` : 'To be decided');
}

function verified(fixture?: FixtureForUi) {
  return fixture?.status === 'COMPLETED' && fixture.match?.status === 'COMPLETED' && fixture.match.confirmedResult?.status === 'CONFIRMED';
}

/** Collapse legs only within the same saved round and bracket position. */
export function buildPlayoffBracket(fixtures: FixtureForUi[]) {
  const groups = new Map<string, FixtureForUi[]>();
  for (const fixture of fixtures) {
    const twoLegged = fixture.phase === 'PLAYOFF' && fixture.roundName.startsWith('UCL ') && [1, 2].includes(fixture.matchday!);
    const key = twoLegged ? `tie-${fixture.roundNumber}-${fixture.bracketPosition}` : fixture.id;
    const group = groups.get(key) ?? [];
    group.push(fixture); groups.set(key, group);
  }
  const ties: BracketTie[] = [];
  const byFixture = new Map<string, string>();
  for (const [id, group] of groups) {
    const legs = [...group].sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));
    const first = legs[0];
    const twoLegged = first.roundName.startsWith('UCL ') && [1, 2].includes(first.matchday!);
    const leg1 = twoLegged ? legs.find(f => f.matchday === 1) : first;
    const leg2 = twoLegged ? legs.find(f => f.matchday === 2) : undefined;
    const paired = Boolean(leg1 && leg2 && leg1.home?.id && leg1.away?.id &&
      leg1.home.id === leg2.away?.id && leg1.away.id === leg2.home?.id);
    const complete = twoLegged ? paired && verified(leg1) && verified(leg2) : verified(first);
    const firstScore = verified(leg1) ? leg1!.match!.confirmedResult! : null;
    const secondScore = paired && verified(leg2) ? leg2!.match!.confirmedResult! : null;
    const score = firstScore ? { home: firstScore.homeScore + (secondScore?.awayScore ?? 0), away: firstScore.awayScore + (secondScore?.homeScore ?? 0) } : null;
    const deciding = twoLegged ? secondScore : firstScore;
    const penalties = deciding?.homePenaltyScore != null && deciding.awayPenaltyScore != null
      ? { home: twoLegged ? deciding.awayPenaltyScore : deciding.homePenaltyScore, away: twoLegged ? deciding.homePenaltyScore : deciding.awayPenaltyScore } : null;
    const winningSide = complete && score ? score.home !== score.away ? (score.home > score.away ? 'home' : 'away')
      : penalties && penalties.home !== penalties.away ? (penalties.home > penalties.away ? 'home' : 'away') : null : null;
    ties.push({ id, label: first.roundName.replace(/\s*·\s*LEG [12]$/, ''), round: first.roundNumber, position: first.bracketPosition,
      fixtures: legs, home: first.home, away: first.away, homeSource: first.homeSource, awaySource: first.awaySource,
      score, penalties, winnerId: winningSide ? first[winningSide]?.id ?? null : null, complete: Boolean(complete), twoLegged,
      locked: twoLegged && (!verified(leg1) || !paired) });
    for (const leg of legs) byFixture.set(leg.id, id);
  }
  ties.sort((a, b) => a.round - b.round || a.position - b.position || a.label.localeCompare(b.label));
  const edges: BracketEdge[] = [];
  for (const tie of ties) for (const slot of ['HOME', 'AWAY'] as const) {
    const source = slot === 'HOME' ? tie.homeSource : tie.awaySource;
    const from = source && byFixture.get(source.id);
    if (from && from !== tie.id) edges.push({ from, to: tie.id, outcome: source!.outcome ?? 'WINNER', slot });
  }
  return { ties, edges };
}

/** Lay out the saved graph; second-chance edges retain their actual targets. */
export function layoutPlayoffBracket(model: ReturnType<typeof buildPlayoffBracket>) {
  const { width: w, height: h, columnGap, rowGap } = BRACKET_CARD;
  const stepX = w + columnGap, stepY = h + rowGap, padding = 28;
  const { ties, edges } = model;
  if (!ties.length) return { nodes: [] as BracketNode[], edges, width: 0, height: 0, mirrored: false, finalId: null };
  const incoming = new Map<string, BracketEdge[]>(), outgoing = new Map<string, BracketEdge[]>();
  const byId = new Map(ties.map(tie => [tie.id, tie]));
  for (const edge of edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  const terminals = ties.filter(tie => !outgoing.has(tie.id));
  const final = terminals.length === 1 ? terminals[0] : null;
  const mirrored = Boolean(final && !edges.some(edge => edge.outcome === 'LOSER') && ties.every(tie => (outgoing.get(tie.id)?.length ?? 0) <= 1));
  const positions = new Map<string, { x: number; y: number; side: BracketNode['side'] }>();
  let boardWidth = 0, boardHeight = 0;
  if (mirrored && final) {
    const roots = incoming.get(final.id) ?? [];
    const maxDepth = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      const next = new Set(seen).add(id);
      return 1 + Math.max(0, ...(incoming.get(id) ?? []).map(edge => maxDepth(edge.from, next)));
    };
    const depth = Math.max(0, ...roots.map(edge => maxDepth(edge.from)));
    const centerX = padding + depth * stepX;
    const sideHeights: number[] = [];
    for (const side of ['left', 'right'] as const) {
      let row = 0;
      const root = roots.find(edge => edge.slot === (side === 'left' ? 'HOME' : 'AWAY'));
      const place = (id: string, distance: number, seen = new Set<string>()): number => {
        if (seen.has(id)) return row++ * stepY;
        const next = new Set(seen).add(id);
        const sources = incoming.get(id) ?? [];
        const ys = sources.map(edge => place(edge.from, distance + 1, next));
        const y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : row++ * stepY;
        positions.set(id, { x: centerX + (side === 'left' ? -1 : 1) * distance * stepX, y, side });
        return y;
      };
      if (root) place(root.from, 1);
      sideHeights.push(Math.max(h, row * stepY - rowGap));
    }
    const maxHeight = Math.max(h, ...sideHeights);
    for (const position of positions.values()) position.y += padding + (maxHeight - sideHeights[position.side === 'left' ? 0 : 1]) / 2;
    positions.set(final.id, { x: centerX, y: padding + (maxHeight - h) / 2, side: 'center' });
    boardWidth = padding * 2 + depth * stepX * 2 + w;
    boardHeight = maxHeight + padding * 2;
  } else {
    const columns = new Map<number, BracketTie[]>();
    const ranks = new Map<string, number>();
    const rank = (id: string, seen = new Set<string>()): number => {
      if (ranks.has(id)) return ranks.get(id)!;
      if (seen.has(id)) return 0;
      const next = new Set(seen).add(id);
      const value = Math.max(0, ...(incoming.get(id) ?? []).map(edge => rank(edge.from, next) + 1));
      ranks.set(id, value); return value;
    };
    for (const tie of ties) { const index = rank(tie.id); columns.set(index, [...(columns.get(index) ?? []), tie]); }
    const rows = Math.max(...[...columns.values()].map(column => column.length));
    boardHeight = padding * 2 + rows * stepY - rowGap;
    boardWidth = padding * 2 + columns.size * stepX - columnGap;
    for (const [column, entries] of columns) entries.forEach((tie, i) => positions.set(tie.id, {
      x: padding + column * stepX, y: padding + (boardHeight - padding * 2) * (i + .5) / entries.length - h / 2, side: 'left',
    }));
  }
  return { nodes: ties.filter(tie => positions.has(tie.id)).map(tie => ({ ...tie, ...positions.get(tie.id)! })),
    edges: edges.filter(edge => byId.has(edge.from) && byId.has(edge.to)), width: boardWidth, height: boardHeight, mirrored, finalId: final?.id ?? null };
}
