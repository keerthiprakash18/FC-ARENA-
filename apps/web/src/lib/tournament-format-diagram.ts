import type { TournamentFormatDescription } from './tournament-format-guide';

export type DiagramTone = 'entry' | 'direct' | 'playoff' | 'out' | 'knockout' | 'champion' | 'pending';
export interface FormatDiagramNode {
  id: string;
  column: number;
  title: string;
  value: number | string;
  unit: string;
  detail: string[];
  tone: DiagramTone;
}
export interface FormatDiagramEdge { from: string; to: string; secondChance?: boolean }
export interface FormatDiagram {
  nodes: FormatDiagramNode[];
  edges: FormatDiagramEdge[];
  summary: string;
  note: string;
}

const roundName = (slots: number) => slots === 2 ? 'Final' : slots === 4 ? 'Semi-finals' : slots === 8 ? 'Quarter-finals' : `Round of ${slots}`;
const places = (from: number, to: number) => from === to ? `Place ${from}` : `Places ${from}–${to}`;

/** A rules diagram, not a prediction of winners or an unpublished fixture draw. */
export function buildTournamentFormatDiagram(guide: TournamentFormatDescription): FormatDiagram {
  const nodes: FormatDiagramNode[] = [], edges: FormatDiagramEdge[] = [];
  const q = guide.qualification, isUcl = guide.competitionFormat === 'UCL_CUP';
  const isSingle = guide.competitionFormat === 'SINGLE_ELIMINATION';
  const label = guide.entryLabel;
  const add = (id: string, column: number, title: string, value: number | string, unit: string, detail: string[], tone: DiagramTone) => {
    nodes.push({ id, column, title, value, unit, detail, tone }); return id;
  };
  const link = (from: string, to: string, secondChance = false) => edges.push({ from, to, secondChance });
  const origin = add('entries', 0, isSingle ? 'Knockout entries' : q.source === 'GROUP_QUALIFIERS' ? 'Group stage' : 'League phase',
    guide.approvedEntries, `approved ${label}`, q.source === 'GROUP_QUALIFIERS' ? [`${guide.groupCount} groups`, 'Ranked by stage results'] : ['Current approved entries', 'See published fixtures'], 'entry');
  const result = () => ({ nodes, edges, summary: q.description,
    note: q.state === 'PENDING' ? 'This preview uses the current setup. Qualification and playoff settings still need to be finalised.'
      : q.state === 'NONE' ? 'Format overview · follow the final confirmed table or the organiser’s published rules. No automatic knockout qualification.'
      : guide.provisional ? 'Format overview · qualification places are provisional until stage results are confirmed. Published fixtures set the draw and byes.'
      : 'Format overview · open the published fixtures for the draw and match results.' });
  const champion = (from: string, column: number, title = 'Champion') => link(from, add('champion', column, title, 1, 'winner', ['The competition winner'], 'champion'));

  if (q.state === 'PENDING' || (guide.playoffFormat === 'DOUBLE_CHANCE' && (q.total ?? 0) < 3)) {
    link(origin, add('pending', 1, 'Setup pending', '—', 'places not finalised', ['Organiser completes setup', 'Places are not finalised'], 'pending'));
    return result();
  }
  if (q.state === 'NONE') {
    if (guide.competitionFormat === 'CUSTOM_MANUAL') {
      nodes[0].title = 'Approved entries';
      link(origin, add('custom', 1, 'Custom format', 'Manual', 'organiser-defined', ['See tournament rules', 'Fixtures and progression'], 'pending'));
    } else {
      nodes[0].title = 'League entries';
      const league = add('league', 1, 'League matches', guide.matchesPerEntry ?? 'See fixtures', guide.matchesPerEntry === null ? 'manual / group schedule' : 'matches per entry', ['Win 3 · draw 1 · loss 0', 'No knockout qualification'], 'knockout');
      link(origin, league); champion(league, 2, 'League winner');
    }
    return result();
  }
  if (q.total === null || q.total < 2) {
    link(origin, add('pending', 1, 'Setup pending', '—', 'qualification places', ['Follow the saved rules', 'and published fixtures'], 'pending'));
    return result();
  }
  if (q.eliminated && q.eliminated > 0) {
    link(origin, add('eliminated', 1, 'Eliminated', q.eliminated, label,
      [q.source === 'GROUP_QUALIFIERS' ? 'Outside qualifying places' : q.bands.length ? places(q.total + 1, guide.approvedEntries) : 'Outside the playoff field', 'Stage ends here'], 'out'));
  }

  const rounds = (from: string[], count: number, firstColumn: number, ucl = false) => {
    const bracket = 2 ** Math.ceil(Math.log2(count));
    let previous = from, column = firstColumn;
    for (let slots = bracket; slots >= 2; slots /= 2) {
      const first = slots === bracket, entrants = first ? count : slots;
      const byes = first ? bracket - count : 0;
      const final = slots === 2;
      const detail = byes ? [`${bracket} bracket slots`, 'Byes follow the draw']
        : ucl ? [final ? 'One-match final' : `${slots / 2} ties · two legs each`, final ? 'Level score: penalties' : 'Aggregate winners advance']
        : [final ? 'Finalists meet for the title' : 'Winners advance', 'See fixtures for each tie'];
      const current = add(`round-${slots}`, column++, roundName(slots), entrants,
        first && byes ? `qualifying ${label}` : first ? label : 'places', detail, 'knockout');
      for (const parent of previous) link(parent, current);
      previous = [current];
    }
    champion(previous[0], column);
  };

  if (isUcl) {
    const direct = q.direct ?? 0, playIn = q.playIn ?? 0;
    const field = direct + playIn / 2, routes: string[] = [];
    if (direct) {
      routes.push(add('direct', 1, 'Direct qualification', direct, label, [places(1, direct), `Straight to ${roundName(field).toLowerCase()}`], 'direct'));
      link(origin, 'direct');
    }
    if (playIn) {
      routes.push(add('playoff', 1, 'Knockout play-offs', playIn, label, [places(direct + 1, q.total), `Two-leg ties · ${playIn / 2} winners`], 'playoff'));
      link(origin, 'playoff');
    }
    rounds(routes, field, 2, true);
    return result();
  }

  let source = origin, column = 1;
  if (!isSingle) {
    const grouped = q.source === 'GROUP_QUALIFIERS';
    source = add('qualifiers', column++, 'Knockout qualifiers', q.total, label,
      grouped ? [`Top ${q.perGroup} from each group`, `${guide.groupCount} groups × ${q.perGroup} places`]
        : q.bands.length ? [q.total === guide.approvedEntries ? 'All entries advance' : `Top ${q.total} in the overall table`, 'After stage is confirmed']
        : ['Uses saved seeding rules', 'See qualification rules'], 'direct');
    link(origin, source);
  }
  if (guide.playoffFormat === 'DOUBLE_CHANCE') {
    const elite = q.total >= 8 ? 4 : 2, lower = q.total - elite, survivors = elite / 2;
    const high = add('seeded-route', column, 'Qualifying ties', elite, 'higher seeds', [`Playoff seeds 1–${elite}`, `${survivors} winners advance directly`], 'direct');
    const low = add('lower-route', column, 'Lower-seed route', lower, label,
      [lower === 1 ? '1 entry to second chance' : 'Lower-seed knockout ties', `${survivors} second-chance ${survivors === 1 ? 'place' : 'places'}`], 'knockout');
    link(source, high); link(source, low);
    const recovery = add('second-chance', column + 1, 'Second chance', elite, label, ['Qualifying-tie losers join', `${survivors} lower-route ${survivors === 1 ? 'survivor' : 'survivors'}`], 'playoff');
    link(high, recovery, true); link(low, recovery);
    rounds([high, recovery], elite, column + 2);
  } else if (!guide.playoffFormat) {
    // Older responses lack the saved bracket format; keep this preview general.
    const bracket = add('bracket', column++, 'Published bracket', q.total, `qualifying ${label}`, ['Draw, byes and progression', 'See published fixtures'], 'knockout');
    link(source, bracket); champion(bracket, column);
  } else {
    rounds([source], q.total, column);
  }
  return result();
}

export interface PlacedDiagramNode extends FormatDiagramNode { x: number; y: number }
export function layoutTournamentFormatDiagram(model: FormatDiagram, landscape: boolean) {
  // Show progressing routes first; terminal elimination is a separate labelled branch.
  const columns = [...new Set(model.nodes.map(node => node.column))].sort((a, b) => a - b);
  const groups = columns.map(column => model.nodes.filter(node => node.column === column).sort((a, b) => Number(a.tone === 'out') - Number(b.tone === 'out')));
  const maxRows = Math.max(...groups.map(group => group.length));
  const nodeWidth = landscape ? 176 : 272, nodeHeight = 124;
  let nextY = 26;
  const nodes: PlacedDiagramNode[] = [];
  groups.forEach((group, index) => {
    group.forEach((node, row) => nodes.push({ ...node,
      x: landscape ? 28 + index * 222 : 40,
      y: landscape ? 68 + ((maxRows - group.length) / 2 + row) * 154 : nextY + row * 152,
    }));
    if (!landscape) nextY += group.length * 152 + 18;
  });
  const lookup = new Map(nodes.map(node => [node.id, node]));
  const edges = model.edges.map((edge, index) => {
    const from = lookup.get(edge.from)!, to = lookup.get(edge.to)!;
    let path: string;
    if (landscape) {
      const sx = from.x + nodeWidth, sy = from.y + nodeHeight / 2, tx = to.x, ty = to.y + nodeHeight / 2;
      path = to.column - from.column > 1
        ? `M ${sx} ${sy} H ${sx + 18} V ${20 + index % 3 * 12} H ${tx - 18} V ${ty} H ${tx}`
        : `M ${sx} ${sy} C ${sx + 24} ${sy}, ${tx - 24} ${ty}, ${tx} ${ty}`;
    } else {
      const singleStep = groups[columns.indexOf(from.column)].length === 1 && groups[columns.indexOf(to.column)].length === 1 && to.column === from.column + 1;
      const split = groups[columns.indexOf(to.column)].length > 1 || edge.secondChance || to.tone === 'out';
      const side = split ? 16 : 336, anchor = split ? 40 : 312;
      path = singleStep ? `M 176 ${from.y + nodeHeight} V ${to.y}`
        : `M ${anchor} ${from.y + nodeHeight / 2} H ${side} V ${to.y + nodeHeight / 2} H ${anchor}`;
    }
    return { ...edge, path, tone: to.tone === 'out' ? 'out' : edge.secondChance ? 'playoff' : to.tone };
  });
  return { nodes, edges, nodeWidth, nodeHeight,
    width: landscape ? columns.length * 222 + 10 : 352,
    height: landscape ? maxRows * 154 + 60 : nextY - 18,
  };
}
