/** Keep existing placements wherever possible; move overflow before redrawing teams. */
export function balanceGroupMembership<T extends { id: string; registrationIds: string[] }>(groups: T[], unassignedIds: string[] = [], protectedIds: string[] = []): T[] {
  if (!groups.length) return [];
  const result = groups.map(group => ({ ...group, registrationIds: [...group.registrationIds] }));
  const total = result.reduce((n, group) => n + group.registrationIds.length, unassignedIds.length);
  const base = Math.floor(total / result.length), remainder = total % result.length;
  const ranked = result.map((group, i) => ({ i, size: group.registrationIds.length })).sort((a, b) => b.size - a.size || a.i - b.i);
  const larger = new Set(ranked.slice(0, remainder).map(row => row.i));
  const targets = result.map((_, i) => base + (larger.has(i) ? 1 : 0));
  const protectedSet = new Set(protectedIds), pool = [...unassignedIds];
  result.forEach((group, i) => {
    while (group.registrationIds.length > targets[i]) {
      // Older Android WebViews do not implement Array.findLastIndex.
      let index = group.registrationIds.length - 1;
      while (index >= 0 && protectedSet.has(group.registrationIds[index])) index--;
      if (index < 0) index = group.registrationIds.length - 1;
      pool.push(...group.registrationIds.splice(index, 1));
    }
  });
  let cursor = 0;
  result.forEach((group, i) => { while (group.registrationIds.length < targets[i]) group.registrationIds.push(pool[cursor++]); });
  return result;
}
