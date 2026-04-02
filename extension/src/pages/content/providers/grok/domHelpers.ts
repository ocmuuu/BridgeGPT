/** Inlined so `grok-page.js` stays a single classic script (no shared chunk `import`). */

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

/** Tailwind `hidden` / ancestors with display:none — submit lives in `.hidden` on Grok. */
export function isInHiddenAncestor(el: Element): boolean {
  let p: Element | null = el;
  while (p) {
    if (p instanceof HTMLElement) {
      const st = window.getComputedStyle(p);
      if (st.display === "none" || st.visibility === "hidden") return true;
      const cls = p.classList;
      if (cls.contains("hidden") || cls.contains("invisible")) return true;
    }
    p = p.parentElement;
  }
  return false;
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
