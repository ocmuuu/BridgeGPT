export function roughTokenCount(text: string): number {
  if (!text) return 0;
  let score = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    score += cp <= 0x7f ? 0.28 : 1;
  }
  return Math.max(0, Math.round(score));
}
