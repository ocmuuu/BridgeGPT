/**
 * Reference copy of `sleep` / `waitFor` for DOM-poll providers.
 * ChatGPT/Gemini/Grok **page-world** bundles inline these in `domHelpers.ts` so
 * `*-page.js` scripts stay single classic bundles (injected without `type="module"`);
 * do not import this file from those entry graphs.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitFor<T>(
  fn: () => T | null | undefined,
  timeoutMs: number,
  intervalMs = 120
): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(intervalMs);
  }
  return null;
}
