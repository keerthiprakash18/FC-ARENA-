export function getUclQualification(teamCount: number) {
  const count = Math.max(2, Math.floor(teamCount));
  const knockoutSize = 2 ** Math.floor(Math.log2(Math.max(2, Math.min(16, Math.floor(count * 2 / 3)))));
  const qualifiers = Math.min(count, knockoutSize * 1.5);
  return { qualifiers, direct: knockoutSize * 2 - qualifiers, knockoutSize };
}
