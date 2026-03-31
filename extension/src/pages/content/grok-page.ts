/**
 * Page-world script for grok.com (injected as `grok-page.js`). Mirrors the Gemini
 * flow: content script posts `bridgegpt_grok_run`, we fill the composer, submit,
 * poll the main thread for the latest `.prose` block, then postMessage back.
 * DOM details may change when the site updates.
 */
(function () {
  const SRC_PAGE = "bridgegpt-grok-page";
  const SRC_CONTENT = "bridgegpt-content-script";
  const MSG_IN = "bridgegpt_grok_run";

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitFor<T>(
    fn: () => T | null | undefined,
    timeoutMs: number,
    interval = 120
  ): Promise<T | null> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  function postToContent(payload: Record<string, unknown>): void {
    window.postMessage(
      {
        data: {
          version: 1,
          source: SRC_PAGE,
          ...payload,
        },
      },
      "*"
    );
  }

  function isProbablyVisible(el: HTMLElement): boolean {
    if (!el.isConnected) return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    if (document.visibilityState !== "visible") return true;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }

  async function waitForPaintTick(): Promise<void> {
    if (document.visibilityState !== "visible") {
      await sleep(50);
      return;
    }
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );
  }

  function findTextareaComposer(): HTMLTextAreaElement | null {
    const direct = document.querySelector(
      'textarea[aria-label*="Ask Grok" i], textarea[aria-label*="ask grok" i]'
    );
    if (direct instanceof HTMLTextAreaElement && isProbablyVisible(direct)) {
      return direct;
    }
    const main = document.querySelector("main");
    if (!main) return null;
    let best: HTMLTextAreaElement | null = null;
    let bestTop = -Infinity;
    for (const el of main.querySelectorAll("textarea")) {
      if (!(el instanceof HTMLTextAreaElement)) continue;
      if (el.getAttribute("aria-hidden") === "true") continue;
      if (!isProbablyVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 24) continue;
      if (r.top > bestTop) {
        bestTop = r.top;
        best = el;
      }
    }
    return best;
  }

  function findProseMirrorComposer(): HTMLElement | null {
    const root = document.querySelector("main") ?? document.body;
    let best: HTMLElement | null = null;
    let bestTop = -Infinity;
    for (const el of root.querySelectorAll(
      'div.ProseMirror[contenteditable="true"]'
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isProbablyVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > bestTop) {
        bestTop = r.top;
        best = el;
      }
    }
    return best;
  }

  function composerFormRoot(el: HTMLElement): HTMLElement | null {
    return el.closest("form");
  }

  function isSubmitHidden(btn: HTMLButtonElement): boolean {
    const st = window.getComputedStyle(btn);
    if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") {
      return true;
    }
    const cls = btn.className?.toString() ?? "";
    return /\binvisible\b/.test(cls);
  }

  function findSubmitButton(composer: HTMLElement): HTMLButtonElement | null {
    const form = composerFormRoot(composer);
    if (form) {
      for (const b of form.querySelectorAll('button[type="submit"]')) {
        if (b instanceof HTMLButtonElement && !isSubmitHidden(b)) return b;
      }
      const labeled = form.querySelector(
        'button[type="submit"][aria-label="Submit"], button[aria-label="Submit"]'
      );
      if (labeled instanceof HTMLButtonElement && !isSubmitHidden(labeled)) {
        return labeled;
      }
    }
    const fallback = document.querySelector(
      'main form button[type="submit"][aria-label="Submit"]'
    );
    if (fallback instanceof HTMLButtonElement && !isSubmitHidden(fallback)) {
      return fallback;
    }
    return null;
  }

  function fillTextarea(ta: HTMLTextAreaElement, text: string): void {
    ta.focus();
    ta.value = text;
    const opts = { bubbles: true, composed: true } as const;
    try {
      ta.dispatchEvent(
        new InputEvent("input", {
          ...opts,
          inputType: "insertText",
          data: text,
        })
      );
    } catch {
      ta.dispatchEvent(new Event("input", opts));
    }
    ta.dispatchEvent(new Event("change", opts));
  }

  function fillProseMirror(el: HTMLElement, text: string): void {
    el.focus();
    el.replaceChildren();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      el.appendChild(p);
    }
    if (el.childNodes.length === 0) {
      el.appendChild(document.createElement("p")).appendChild(
        document.createElement("br")
      );
    }
    const opts = { bubbles: true, composed: true } as const;
    el.dispatchEvent(
      new InputEvent("input", { ...opts, inputType: "insertText", data: text })
    );
    el.dispatchEvent(new Event("change", opts));
  }

  async function submitComposer(
    composer: HTMLElement,
    btn: HTMLButtonElement
  ): Promise<void> {
    composer.focus();
    await sleep(16);
    btn.focus();
    await waitForPaintTick();
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + Math.max(1, rect.width) / 2;
    const cy = rect.top + Math.max(1, rect.height) / 2;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: cx,
      clientY: cy,
      view: window,
    } as const;
    let usedPointer = false;
    try {
      btn.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...base,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          buttons: 1,
        })
      );
      btn.dispatchEvent(
        new MouseEvent("mousedown", { ...base, button: 0, buttons: 1 })
      );
      btn.dispatchEvent(
        new PointerEvent("pointerup", {
          ...base,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          buttons: 0,
        })
      );
      btn.dispatchEvent(
        new MouseEvent("mouseup", { ...base, button: 0, buttons: 0 })
      );
      btn.dispatchEvent(new MouseEvent("click", { ...base, button: 0 }));
      usedPointer = true;
    } catch {
      /* PointerEvent missing */
    }
    if (!usedPointer) btn.click();

    await sleep(24);
    composer.focus();
    const ke = { bubbles: true, composed: true, cancelable: true } as const;
    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
    composer.dispatchEvent(
      new KeyboardEvent("keydown", {
        ...ke,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        metaKey: isMac,
        ctrlKey: !isMac,
      })
    );
  }

  function excludeComposerTree(): HTMLElement | null {
    const ta = findTextareaComposer();
    if (ta) return composerFormRoot(ta);
    const pm = findProseMirrorComposer();
    if (pm) return composerFormRoot(pm) ?? pm.closest("footer");
    return null;
  }

  function normalizeChat(s: string): string {
    return s.trim().replace(/\s+/g, " ");
  }

  function collectLatestAssistantPlain(): string {
    const main = document.querySelector("main");
    if (!main) return "";
    const exclude = excludeComposerTree();
    let best: HTMLElement | null = null;
    let bestTop = -1e9;
    const selectors = [".flex.flex-col.prose", ".prose"];
    for (const sel of selectors) {
      for (const node of main.querySelectorAll(sel)) {
        if (!(node instanceof HTMLElement)) continue;
        if (exclude && exclude.contains(node)) continue;
        const t = (node.innerText || "").trim();
        if (t.length < 2) continue;
        const r = node.getBoundingClientRect();
        if (r.height < 6) continue;
        if (r.top >= bestTop) {
          bestTop = r.top;
          best = node;
        }
      }
    }
    return best ? (best.innerText || "").trim() : "";
  }

  async function runAsk(text: string): Promise<void> {
    const captureBase: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
    };

    const ta = findTextareaComposer();
    const pm = ta ? null : findProseMirrorComposer();
    const composer = ta ?? pm;
    if (!composer) {
      postToContent({
        assistantText: "",
        capture: { ...captureBase, ok: false, reason: "no_input" },
        page: { href: location.href, title: document.title },
      });
      return;
    }

    if (ta) fillTextarea(ta, text);
    else fillProseMirror(pm!, text);

    await sleep(120);
    let btn = findSubmitButton(composer);
    if (!btn) {
      postToContent({
        assistantText: "",
        capture: { ...captureBase, ok: false, reason: "no_send_button" },
        page: { href: location.href, title: document.title },
      });
      return;
    }

    const before = collectLatestAssistantPlain();
    await submitComposer(composer, btn);

    const want = normalizeChat(text);
    let lastText = "";
    let stableTicks = 0;
    const maxTicks = 600;
    const pollMs = 200;

    for (let i = 0; i < maxTicks; i++) {
      await sleep(pollMs);
      const cur = collectLatestAssistantPlain();
      if (!cur || cur === before) continue;
      if (want && normalizeChat(cur) === want) continue;
      if (cur === lastText) stableTicks += 1;
      else {
        stableTicks = 0;
        lastText = cur;
      }
      if (stableTicks >= 3 && cur.length > 0) {
        postToContent({
          assistantText: cur,
          capture: {
            ...captureBase,
            completedAt: new Date().toISOString(),
            stableTicks,
            pollTicks: i,
          },
          page: { href: location.href, title: document.title },
        });
        return;
      }
    }

    const final = collectLatestAssistantPlain();
    const use =
      final &&
      final !== before &&
      (!want || normalizeChat(final) !== want)
        ? final
        : lastText;
    postToContent({
      assistantText: use,
      capture: {
        ...captureBase,
        completedAt: new Date().toISOString(),
        reason: "timeout_or_partial",
        pollTicks: maxTicks,
      },
      page: { href: location.href, title: document.title },
    });
  }

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as {
      source?: string;
      type?: string;
      text?: string;
    } | null;
    if (!d || d.source !== SRC_CONTENT || d.type !== MSG_IN) return;
    const t = typeof d.text === "string" ? d.text : "";
    void runAsk(t);
  });
})();
