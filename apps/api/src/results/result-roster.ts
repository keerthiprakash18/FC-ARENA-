// APPLY events record who played when a result was confirmed. A later roster
// replacement must not transfer that player's completed matches to someone else.
export function resultPlayerIds(
  result: { statEvents?: Array<{ payload: unknown }> } | null | undefined,
  side: 'home' | 'away',
  fallback: Array<{ userId: string }>,
): string[] {
  for (const event of result?.statEvents ?? []) {
    const payload = event.payload as Record<string, { userIds?: unknown }> | null;
    const ids = payload?.[side]?.userIds;
    if (Array.isArray(ids) && ids.every((id): id is string => typeof id === 'string')) {
      return [...new Set(ids)];
    }
  }
  return fallback.map((member) => member.userId);
}
