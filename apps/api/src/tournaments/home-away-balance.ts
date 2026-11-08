/** Orient a draw with equal home/away counts, or a difference of one for odd totals. */
export function balanceHomeAwayPairs(
  pairs: ReadonlyArray<readonly [string, string]>,
): Array<[string, string]> {
  const ids: string[] = [];
  const indices = new Map<string, number>();
  const adjacency: Array<Array<{ index: number; other: number }>> = [];

  function vertex(id: string): number {
    const existing = indices.get(id);
    if (existing !== undefined) return existing;
    const index = ids.length;
    ids.push(id);
    indices.set(id, index);
    adjacency.push([]);
    return index;
  }

  function addEdge(left: number, right: number, index: number): void {
    adjacency[left].push({ index, other: right });
    adjacency[right].push({ index, other: left });
  }

  pairs.forEach(([left, right], index) => addEdge(vertex(left), vertex(right), index));

  // Connecting odd-degree teams to a temporary vertex makes every degree even.
  // Direct each closed trail consistently, then discard the temporary edges.
  // Every real team then has equal in/out degree, or a difference of one.
  const oddVertices = adjacency.flatMap((edges, index) => edges.length % 2 ? [index] : []);
  const temporary = adjacency.length;
  adjacency.push([]);
  oddVertices.forEach((index, offset) => addEdge(index, temporary, pairs.length + offset));

  const used = new Uint8Array(pairs.length + oddVertices.length);
  const directions: Array<[string, string]> = [];
  for (let start = 0; start < adjacency.length; start++) {
    let current = start;
    while (adjacency[current].length) {
      const edge = adjacency[current].pop()!;
      if (used[edge.index]) continue;
      used[edge.index] = 1;
      if (edge.index < pairs.length) {
        directions[edge.index] = [ids[current], ids[edge.other]];
      }
      current = edge.other;
    }
  }

  return directions;
}
