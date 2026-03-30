/**
 * Runs in the page's main world (injected script) so it can reach shadow DOM
 * inside custom elements such as `rich-textarea`. Keep in sync with
 * `webProviders/gemini/GeminiPage.tsx` message constants.
 */
(function () {
  const SRC_PAGE = "bridgegpt-gemini-page";
  const SRC_CONTENT = "bridgegpt-content-script";
  const MSG_IN = "bridgegpt_gemini_run";

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
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }

  /** Last matching node in document order (bottom composer after multi-turn chat). */
  function lastMatchingElement(
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

  /**
   * Gemini input-area-v2 + Quill: real editor is
   * `rich-textarea > div.ql-editor[contenteditable]` (light DOM).
   * Avoid `div.ql-clipboard` — it is also contenteditable and is not the prompt field.
   * After several turns, `querySelector` can hit a stale/hidden composer; prefer the
   * last visible editor in the input strip / footer.
   */
  function findEditableRoot(): HTMLElement | null {
    const qlPred = (el: HTMLElement) =>
      !el.classList.contains("ql-clipboard") && isProbablyVisible(el);

    const scopedSelectors = [
      '[data-node-type="input-area"] rich-textarea div.ql-editor[contenteditable="true"]',
      '[data-node-type="input-area"] div.ql-editor[contenteditable="true"]',
      "footer rich-textarea div.ql-editor[contenteditable='true']",
      'footer div.ql-editor[contenteditable="true"]',
    ];
    for (const sel of scopedSelectors) {
      const hit = lastMatchingElement(sel, qlPred);
      if (hit) return hit;
    }

    const qlInRich = lastMatchingElement(
      "rich-textarea div.ql-editor[contenteditable='true'], rich-textarea div.ql-editor[contenteditable=\"true\"]",
      qlPred
    );
    if (qlInRich) return qlInRich;

    const richList = document.querySelectorAll("rich-textarea");
    for (let i = richList.length - 1; i >= 0; i--) {
      const rich = richList[i] as HTMLElement & {
        shadowRoot?: ShadowRoot | null;
      };
      if (rich?.shadowRoot) {
        const e =
          rich.shadowRoot.querySelector("div.ql-editor[contenteditable='true']") ||
          rich.shadowRoot.querySelector('[contenteditable="true"]');
        if (e instanceof HTMLElement && qlPred(e)) return e;
      }
    }

    const candidates = document.querySelectorAll(
      'div.ql-editor[contenteditable="true"], [contenteditable="true"]'
    );
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i];
      if (!(el instanceof HTMLElement)) continue;
      if (el.classList.contains("ql-clipboard")) continue;
      if (!qlPred(el)) continue;
      if (
        el.closest(
          "footer, [role='search'], form, nav, header, [class*='input'], [class*='footer'], .text-input-field"
        )
      ) {
        return el;
      }
    }
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i];
      if (!(el instanceof HTMLElement)) continue;
      if (el.classList.contains("ql-clipboard")) continue;
      if (qlPred(el)) return el;
    }
    return null;
  }

  function isSendButtonDisabled(btn: HTMLButtonElement): boolean {
    if (btn.disabled) return true;
    if (btn.getAttribute("aria-disabled") === "true") return true;
    if (btn.classList.contains("mat-mdc-button-disabled")) return true;
    return false;
  }

  /**
   * Send control next to the same composer we filled (avoids a stale global match).
   * Matches simplified UI: `button.send-button.submit.has-input`.
   */
  function querySendButtonNearEditor(editable: HTMLElement): HTMLButtonElement | null {
    const root =
      editable.closest("[data-node-type='input-area']") ??
      editable.closest("input-area-v2") ??
      editable.closest("fieldset.input-area-container");
    if (!root) return null;
    const prefer = root.querySelectorAll(
      "button.send-button.submit, button.send-button.has-input, button.send-button"
    );
    for (let i = prefer.length - 1; i >= 0; i--) {
      const b = prefer[i];
      if (b instanceof HTMLButtonElement) return b;
    }
    return null;
  }

  function querySendButton(): HTMLButtonElement | null {
    const composerScoped = [
      '[data-node-type="input-area"] button.send-button',
      "footer button.send-button",
      ".text-input-field button.send-button",
    ];
    for (const sel of composerScoped) {
      const el = lastMatchingElement(
        sel,
        (b) => b instanceof HTMLButtonElement && isProbablyVisible(b)
      );
      if (el instanceof HTMLButtonElement) return el;
    }

    const selectors = [
      "button.send-button.submit",
      'button.send-button[aria-label="Send message"]',
      "button.send-button",
      'button.submit[aria-label="Send message"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send" i]',
    ];
    for (const sel of selectors) {
      const el = lastMatchingElement(
        sel,
        (b) => b instanceof HTMLButtonElement && isProbablyVisible(b)
      );
      if (el instanceof HTMLButtonElement) return el;
    }
    return null;
  }

  function findSendButton(): HTMLButtonElement | null {
    return querySendButton();
  }

  /** Angular enables the send control via aria-disabled; wait after typing. */
  async function waitForEnabledSendButton(
    timeoutMs: number,
    editable?: HTMLElement
  ): Promise<HTMLButtonElement | null> {
    return waitFor(() => {
      const b =
        (editable ? querySendButtonNearEditor(editable) : null) ??
        querySendButton();
      if (!b || isSendButtonDisabled(b)) return null;
      return b;
    }, timeoutMs);
  }

  /**
   * Plain HTMLElement.click() is often ignored by Angular Material; add pointer
   * events + Enter on the editor (enterkeyhint=send on Gemini).
   */
  async function submitComposer(editable: HTMLElement, btn: HTMLButtonElement): Promise<void> {
    editable.focus();
    await sleep(16);
    btn.focus();
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

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
      /* PointerEvent missing in very old engines */
    }
    if (!usedPointer) {
      btn.click();
    }

    await sleep(24);
    editable.focus();
    const ke = { bubbles: true, composed: true, cancelable: true } as const;
    editable.dispatchEvent(
      new KeyboardEvent("keydown", {
        ...ke,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
      })
    );
    editable.dispatchEvent(
      new KeyboardEvent("keyup", {
        ...ke,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
      })
    );
  }

  function fillQuillEditor(editable: HTMLElement, text: string): void {
    editable.focus();
    // Gemini (Trusted Types) blocks innerHTML assignment; clear via DOM APIs only.
    editable.replaceChildren();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      editable.appendChild(p);
    }
    if (editable.childNodes.length === 0) {
      editable.appendChild(document.createElement("p")).appendChild(
        document.createElement("br")
      );
    }

    const opts = { bubbles: true, composed: true } as const;
    try {
      editable.dispatchEvent(
        new InputEvent("beforeinput", {
          ...opts,
          inputType: "insertFromPaste",
          data: text,
        })
      );
    } catch {
      /* older browsers */
    }
    editable.dispatchEvent(new Event("input", opts));
    editable.dispatchEvent(
      new InputEvent("input", { ...opts, inputType: "insertText", data: text })
    );
    editable.dispatchEvent(new Event("change", opts));
    editable.dispatchEvent(new KeyboardEvent("keyup", { ...opts, key: "a" }));
  }

  /** Prefer the last non-empty node (Gemini may append empty response placeholders). */
  function lastNonEmptyText(nodes: Iterable<Element>): string {
    const list = Array.from(nodes);
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i].textContent?.trim() ?? "";
      if (t) return t;
    }
    return "";
  }

  function normalizeChatPrompt(s: string): string {
    return s
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function userQueryTextFromConversation(c: Element): string {
    const lines = c.querySelectorAll("user-query .query-text-line");
    const parts: string[] = [];
    for (const el of lines) {
      parts.push(el.textContent ?? "");
    }
    let raw = parts.join(" ").trim();
    if (!raw) {
      raw =
        c.querySelector("user-query .query-text")?.textContent?.trim() ?? "";
    }
    if (!raw) {
      raw = c.querySelector("user-query")?.textContent?.trim() ?? "";
    }
    return raw.replace(/\bYou said\b/gi, "").replace(/\s+/g, " ").trim();
  }

  /**
   * Most recent `conversation-container` whose user bubble matches this prompt.
   * Scan from end so follow-up turns (e.g. "how about apple") are not confused with earlier ones.
   */
  function findConversationForPrompt(prompt: string): Element | null {
    const want = normalizeChatPrompt(prompt);
    if (!want) return null;
    const containers = document.querySelectorAll("div.conversation-container");
    for (let i = containers.length - 1; i >= 0; i--) {
      const c = containers[i];
      const got = normalizeChatPrompt(userQueryTextFromConversation(c));
      if (!got) continue;
      if (got === want) return c;
      if (want.length >= 4 && got.includes(want)) return c;
      if (got.length >= 4 && want.includes(got)) return c;
    }
    return null;
  }

  function assistantMarkdownRoot(mr: Element): HTMLElement | null {
    const polite = mr.querySelector('.markdown[aria-live="polite"]');
    if (polite instanceof HTMLElement) return polite;
    const panel = mr.querySelector(".markdown.markdown-main-panel");
    if (panel instanceof HTMLElement) return panel;
    const inner = mr.querySelector("message-content .markdown");
    if (inner instanceof HTMLElement) return inner;
    const mc = mr.querySelector("message-content");
    if (mc instanceof HTMLElement) return mc;
    return null;
  }

  /**
   * Read assistant text only for the turn we just sent. Prevents turn 2 from resolving
   * while the DOM still exposes turn 1's stable answer (global "last model-response" bug).
   */
  function collectModelReplyTextForPrompt(prompt: string): string {
    const c = findConversationForPrompt(prompt);
    if (!c) return "";
    const mr = c.querySelector("model-response");
    if (!mr) return "";
    const root = assistantMarkdownRoot(mr);
    return root?.textContent?.trim() ?? "";
  }

  function isMarkdownIdleForPrompt(prompt: string): boolean {
    const c = findConversationForPrompt(prompt);
    if (!c) return false;
    const mr = c.querySelector("model-response");
    if (!mr) return false;
    const root = assistantMarkdownRoot(mr);
    if (!(root instanceof HTMLElement)) return false;
    return root.getAttribute("aria-busy") !== "true";
  }

  /**
   * Fallback when prompt matching is unavailable (empty prompt).
   * Latest assistant body across the thread — do not use for multi-turn capture.
   */
  function collectModelReplyTextGlobal(): string {
    const chains: string[] = [
      'model-response .markdown[aria-live="polite"]',
      "model-response message-content",
      '[class*="model-response-text"] .markdown[aria-live="polite"]',
      '[class*="model-response-text"] message-content',
      'message-content[class*="model-response"]',
    ];
    for (const sel of chains) {
      const t = lastNonEmptyText(document.querySelectorAll(sel));
      if (t) return t;
    }
    const shells = document.querySelectorAll('[class*="model-response-text"]');
    const fromShell = lastNonEmptyText(shells);
    if (fromShell) return fromShell;
    return lastNonEmptyText(document.querySelectorAll("message-content"));
  }

  async function runAsk(text: string): Promise<void> {
    const captureBase: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
    };

    const editable = await waitFor(findEditableRoot, 20000);
    if (!editable) {
      postToContent({
        assistantText: "",
        capture: { ...captureBase, ok: false, reason: "no_input" },
        page: { href: location.href, title: document.title },
      });
      return;
    }

    fillQuillEditor(editable, text);

    await sleep(120);
    let btn =
      (await waitForEnabledSendButton(12000, editable)) ??
      querySendButtonNearEditor(editable) ??
      (await waitFor(findSendButton, 2000)) ??
      findSendButton();
    if (!btn) {
      postToContent({
        assistantText: "",
        capture: { ...captureBase, ok: false, reason: "no_send_button" },
        page: { href: location.href, title: document.title },
      });
      return;
    }
    if (isSendButtonDisabled(btn)) {
      fillQuillEditor(editable, text);
      await sleep(200);
      btn =
        (await waitForEnabledSendButton(8000, editable)) ??
        querySendButtonNearEditor(editable) ??
        querySendButton() ??
        btn;
    }
    if (!btn || isSendButtonDisabled(btn)) {
      postToContent({
        assistantText: "",
        capture: {
          ...captureBase,
          ok: false,
          reason: "send_button_stayed_disabled",
        },
        page: { href: location.href, title: document.title },
      });
      return;
    }
    const near = querySendButtonNearEditor(editable);
    if (near && !isSendButtonDisabled(near)) {
      btn = near;
    }
    await submitComposer(editable, btn);

    let lastText = "";
    let stableTicks = 0;
    const maxTicks = 600;
    const pollMs = 200;
    const promptNorm = normalizeChatPrompt(text);
    const pickText = () =>
      promptNorm
        ? collectModelReplyTextForPrompt(text)
        : collectModelReplyTextGlobal();
    const pickIdle = () =>
      promptNorm ? isMarkdownIdleForPrompt(text) : false;

    for (let i = 0; i < maxTicks; i++) {
      await sleep(pollMs);
      const t = pickText();
      if (t && t === lastText) stableTicks += 1;
      else {
        stableTicks = 0;
        lastText = t;
      }
      const uiIdle = pickIdle();
      const needStable = uiIdle ? 2 : 4;
      if (stableTicks >= needStable && lastText.length > 0) {
        postToContent({
          assistantText: lastText,
          capture: {
            ...captureBase,
            completedAt: new Date().toISOString(),
            stableTicks,
            pollTicks: i,
            uiIdle,
          },
          page: { href: location.href, title: document.title },
        });
        return;
      }
    }

    postToContent({
      assistantText: promptNorm ? pickText() || lastText : lastText,
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
    const text = typeof d.text === "string" ? d.text : "";
    void runAsk(text);
  });
})();
