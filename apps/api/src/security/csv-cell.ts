// CSV quotes escape separators, but do not prevent spreadsheet formula execution.
// Keep actual numeric statistics numeric; treat user-authored formula prefixes as text.
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const numeric = /^-?\d+(?:\.\d+)?$/.test(text);
  const formula = /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(text);
  const safe = !numeric && formula ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
