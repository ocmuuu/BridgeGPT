/** Inlined so `gemini-page.js` stays a single classic script (no shared chunk `import`). */

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

export function isProbablyVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const st = window.getComputedStyle(el);
  if (st.display === "none" || st.visibility === "hidden") return false;
  if (document.visibilityState !== "visible") return true;
  const r = el.getBoundingClientRect();
  return r.width >= 2 && r.height >= 2;
}

export async function waitForPaintTick(): Promise<void> {
  if (document.visibilityState !== "visible") {
    await sleep(50);
    return;
  }
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );
}

/** Last matching node in document order (bottom composer after multi-turn chat). */
export function lastMatchingElement(
  selector: string,
  pred: (el: HTMLElement) => boolean
): HTMLElement | null {
  const list = document.querySelectorAll(selector);
  for (let i = list.length - 1; i >= 0; i--) {
    const el = list[i];
    if (el instanceof HTMLElement && pred(el)) return el;
  }
  return null;
}
