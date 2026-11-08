/** Compare release names for older WebViews that expose a name but no version code. */
export function compareAndroidVersions(
  left: string,
  right: string,
): number | null {
  const parse = (value: string) => {
    if (value.length > 40) return null;
    const match =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
        value,
      );
    if (!match) return null;
    const core = match.slice(1, 4).map(Number);
    if (!core.every(Number.isSafeInteger)) return null;
    const pre = match[4]?.split('.') ?? [];
    if (
      pre.some(
        (part) =>
          !part ||
          (/^\d+$/.test(part) && part.length > 1 && part.startsWith('0')),
      )
    )
      return null;
    return { core, pre };
  };
  const a = parse(left),
    b = parse(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++)
    if (a.core[i] !== b.core[i]) return Math.sign(a.core[i] - b.core[i]);
  if (!a.pre.length || !b.pre.length)
    return Math.sign(b.pre.length - a.pre.length);
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i],
      y = b.pre[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const nx = /^\d+$/.test(x),
      ny = /^\d+$/.test(y);
    if (nx && ny)
      return x.length !== y.length
        ? Math.sign(x.length - y.length)
        : x < y
          ? -1
          : 1;
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
