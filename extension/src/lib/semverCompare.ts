/** Numeric semver compare: `1.10.0` > `1.9.0`. Non-numeric suffixes truncated (e.g. `1.0.0-beta` → `1.0.0`). */
export function compareSemver(a: string, b: string): number {
  const parse = (s: string) =>
    s.split(".").map((part) => {
      const n = parseInt(/^\d+/.exec(part)?.[0] ?? "", 10);
      return Number.isFinite(n) ? n : 0;
    });
  const pa = parse(a.trim());
  const pb = parse(b.trim());
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}
