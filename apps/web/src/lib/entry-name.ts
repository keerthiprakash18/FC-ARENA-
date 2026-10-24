export function normalizeTeamName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}
