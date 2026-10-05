// Keep credential lookup and brute-force quotas on the same identifier.
export function normalizeLoginIdentifier(value: string): string {
  return value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}
