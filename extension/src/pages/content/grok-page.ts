/**
 * Page-world script for grok.com (injected as `grok-page.js`). Mirrors the Gemini
 * flow: content script posts `bridgegpt_grok_run`, we fill the composer, submit,
 * poll the main thread for the latest assistant body, then postMessage back.
 *
 * New tabs often use Tiptap (ProseMirror) in `main form` with the real submit
 * control hidden/disabled — use Mod+Enter to send. DOM may change on site updates.
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
    interval = 140
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

  /** Tailwind `hidden` / ancestors with display:none — submit lives in `.hidden` on Grok. */
  function isInHiddenAncestor(el: Element): boolean {
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

  function findProseMirrorInMainForms(): HTMLElement | null {
    for (const form of document.querySelectorAll("main form")) {
      const pm = form.querySelector(
        'div.ProseMirror[contenteditable="true"], div.tiptap.ProseMirror[contenteditable="true"]'
      );
      if (pm instanceof HTMLElement && isProbablyVisible(pm) && !isInHiddenAncestor(pm)) {
        return pm;
      }
    }
    return null;
  }

  function findProseMirrorFallback(): HTMLElement | null {
    const root = document.querySelector("main") ?? document.body;
    let best: HTMLElement | null = null;
    let bestTop = -Infinity;
    for (const el of root.querySelectorAll(
      'div.ProseMirror[contenteditable="true"]'
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isProbablyVisible(el)) continue;
      if (isInHiddenAncestor(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > bestTop) {
        bestTop = r.top;
        best = el;
      }
    }
    return best;
  }

  type ComposerPick = {
    el: HTMLElement;
    kind: "textarea" | "prose";
    form: HTMLFormElement | null;
  };

  function pickComposer(): ComposerPick | null {
    const pmForm = findProseMirrorInMainForms();
    if (pmForm) {
      return {
        el: pmForm,
        kind: "prose",
        form: pmForm.closest("form"),
      };
    }
    const ta = findTextareaComposer();
    if (ta) {
      return { el: ta, kind: "textarea", form: ta.closest("form") };
    }
    const pm = findProseMirrorFallback();
    if (pm) {
      return { el: pm, kind: "prose", form: pm.closest("form") };
    }
    return null;
  }

  function findVisibleSubmitButton(form: HTMLFormElement | null): HTMLButtonElement | null {
    if (!form) return null;
    for (const b of form.querySelectorAll('button[type="submit"]')) {
      if (!(b instanceof HTMLButtonElement)) continue;
      if (b.disabled) continue;
      if (isInHiddenAncestor(b)) continue;
      if (!isProbablyVisible(b)) continue;
      return b;
    }
    for (const b of form.querySelectorAll("button")) {
      if (!(b instanceof HTMLButtonElement)) continue;
      if (b.disabled) continue;
      if (isInHiddenAncestor(b)) continue;
      if (!isProbablyVisible(b)) continue;
      const al = (b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (
        al === "submit" ||
        al === "提交" ||
        al.includes("send") ||
        al.includes("傳送")
      ) {
        return b;
      }
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
    try {
      el.dispatchEvent(
        new InputEvent("beforeinput", {
          ...opts,
          inputType: "insertFromPaste",
          data: text,
        })
      );
    } catch {
      /* ignore */
    }
    el.dispatchEvent(
      new InputEvent("input", { ...opts, inputType: "insertText", data: text })
    );
    el.dispatchEvent(new Event("change", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", { ...opts, key: "a" }));
  }

  async function clickSubmitButton(
    composer: HTMLElement,
    btn: HTMLButtonElement
  ): Promise<void> {
    composer.focus();
    await sleep(20);
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
    } catch {
      btn.click();
    }
  }

  /** Grok Tiptap often uses Mod+Enter to send when type=submit is hidden/disabled. */
  function dispatchModEnter(el: HTMLElement): void {
    el.focus();
    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
    const base = { bubbles: true, composed: true, cancelable: true } as const;
    for (const type of ["keydown", "keypress", "keyup"] as const) {
      el.dispatchEvent(
        new KeyboardEvent(type, {
          ...base,
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          metaKey: isMac,
          ctrlKey: !isMac,
        })
      );
    }
  }

  function dispatchPlainEnter(el: HTMLElement): void {
    const base = { bubbles: true, composed: true, cancelable: true } as const;
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        ...base,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
      })
    );
  }

  async function submitFilled(
    composer: HTMLElement,
    form: HTMLFormElement | null,
    _kind: "textarea" | "prose"
  ): Promise<void> {
    const btn = findVisibleSubmitButton(form);
    if (btn) {
      await clickSubmitButton(composer, btn);
      return;
    }
    await sleep(100);
    dispatchModEnter(composer);
    await sleep(80);
    dispatchPlainEnter(composer);
  }

  function excludeComposerTree(): HTMLElement | null {
    const pick = pickComposer();
    if (!pick) return null;
    if (pick.form) return pick.form;
    return pick.el.closest("footer");
  }

  function normalizeChat(s: string): string {
    return s.trim().replace(/\s+/g, " ");
  }

  /** User rows use `items-end`, assistant rows `items-start` (same `response-*` wrapper id). */
  function isUserMessageMarkdown(el: HTMLElement): boolean {
    const row = el.closest('div[id^="response-"]');
    if (!(row instanceof HTMLElement)) return false;
    return row.classList.contains("items-end");
  }

  function isInsideThinkingUi(el: HTMLElement): boolean {
    return !!el.closest(".thinking-container");
  }

  /** Grok placeholder replies when the real user text never reached the model. */
  function isAssistantBoilerplate(text: string): boolean {
    const t = text.trim();
    if (!t) return true;
    const low = normalizeChat(t).toLowerCase();
    if (/^參考以下內容[:：]?\s*$/i.test(t)) return true;
    if (/^参考以下内容[:：]?\s*$/i.test(t)) return true;
    if (/^refer to the following content[:：]?\s*$/i.test(low)) return true;
    if (/user message only says/.test(low) && /refer to the following/i.test(low)) {
      return true;
    }
    if (/請提供您要我參考的內容/.test(t) && t.length < 200) return true;
    if (/请提供您要我参考的内容/.test(t) && t.length < 200) return true;
    if (/please provide (the )?content (you want|for me)/i.test(t) && t.length < 200) {
      return true;
    }
    return false;
  }

  /**
   * Only read `.response-content-markdown` under assistant rows (not user, not thinking UI).
   * Broad `.prose` selectors pulled in thinking labels / wrong bubbles and caused short
   * English “preview” text to stabilize before the real answer finished streaming.
   */
  function collectLatestAssistantPlain(promptNorm: string): string {
    const main = document.querySelector("main");
    if (!main) return "";
    const exclude = excludeComposerTree();

    const collectFrom = (root: ParentNode): HTMLElement[] => {
      const out: HTMLElement[] = [];
      for (const node of root.querySelectorAll(".response-content-markdown")) {
        if (!(node instanceof HTMLElement)) continue;
        if (exclude && exclude.contains(node)) continue;
        if (node.closest("form")) continue;
        if (isInsideThinkingUi(node)) continue;
        if (isUserMessageMarkdown(node)) continue;
        out.push(node);
      }
      return out;
    };

    const lastReply = document.querySelector("#last-reply-container");
    const inLast = lastReply ? collectFrom(lastReply) : [];
    /** If `#last-reply-container` exists but assistant markdown is not there yet, do not fall back to older turns in `main`. */
    const candidates =
      inLast.length > 0
        ? inLast
        : lastReply
          ? []
          : collectFrom(main);

    const score = (node: HTMLElement): number => {
      const inLastEl = !!(lastReply && lastReply.contains(node));
      const r = node.getBoundingClientRect();
      const top = Number.isFinite(r.top) ? r.top : 0;
      return (inLastEl ? 1e9 : 0) + top;
    };

    const sorted = [...candidates].sort((a, b) => score(b) - score(a));

    let best: HTMLElement | null = null;
    let bestScore = -Infinity;
    for (const node of sorted) {
      const t = (node.innerText || "").trim();
      if (t.length < 2) continue;
      if (promptNorm && normalizeChat(t) === promptNorm) continue;
      if (isAssistantBoilerplate(t)) continue;
      const r = node.getBoundingClientRect();
      if (r.height < 4) continue;
      const s = score(node);
      if (s >= bestScore) {
        bestScore = s;
        best = node;
      }
    }
    return best ? (best.innerText || "").trim() : "";
  }

  /** Short stable English one-liner while user asked in CJK — likely preview, keep polling. */
  function isLikelyGrokPreviewSnippet(prompt: string, reply: string): boolean {
    if (reply.length >= 200) return false;
    const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(prompt);
    if (!hasCjk) return false;
    const nonWs = reply.replace(/\s/g, "");
    if (!nonWs.length) return false;
    const nonAsciiRatio =
      nonWs.replace(/[\u0000-\u007f]/g, "").length / nonWs.length;
    return nonAsciiRatio < 0.15 && reply.length < 180;
  }

  function stableTicksNeeded(replyLen: number): number {
    if (replyLen < 80) return 12;
    if (replyLen < 240) return 8;
    return 4;
  }

  async function runAsk(text: string): Promise<void> {
    const captureBase: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
    };

    const picked = await waitFor(pickComposer, 28000);
    if (!picked) {
      postToContent({
        assistantText: "",
        capture: { ...captureBase, ok: false, reason: "no_input" },
        page: { href: location.href, title: document.title },
      });
      return;
    }

    const { el: composer, kind, form } = picked;
    if (kind === "textarea") {
      fillTextarea(composer as HTMLTextAreaElement, text);
    } else {
      fillProseMirror(composer, text);
    }

    await sleep(kind === "prose" ? 450 : 200);

    const want = normalizeChat(text);
    const before = collectLatestAssistantPlain(want);
    await submitFilled(composer, form, kind);
    let lastText = "";
    let stableTicks = 0;
    const maxTicks = 600;
    const pollMs = 200;

    for (let i = 0; i < maxTicks; i++) {
      await sleep(pollMs);
      let cur = collectLatestAssistantPlain(want);
      if (isAssistantBoilerplate(cur)) {
        cur = "";
      }
      if (!cur || cur === before) continue;
      if (want && normalizeChat(cur) === want) continue;
      if (cur === lastText) stableTicks += 1;
      else {
        stableTicks = 0;
        lastText = cur;
      }
      const needStable = stableTicksNeeded(cur.length);
      const previewSnip = isLikelyGrokPreviewSnippet(text, cur);
      if (
        stableTicks >= needStable &&
        cur.length > 0 &&
        !previewSnip
      ) {
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

    let final = collectLatestAssistantPlain(want);
    if (isAssistantBoilerplate(final)) final = "";
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
