import {
  isProbablyVisible,
  lastMatchingElement,
  sleep,
  waitFor,
  waitForPaintTick,
} from "./domHelpers";

export function isGeminiSendButtonDisabled(btn: HTMLButtonElement): boolean {
  if (btn.disabled) return true;
  if (btn.getAttribute("aria-disabled") === "true") return true;
  if (btn.classList.contains("mat-mdc-button-disabled")) return true;
  return false;
}

export function queryGeminiSendButtonNearEditor(
  editable: HTMLElement
): HTMLButtonElement | null {
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

export function queryGeminiSendButton(): HTMLButtonElement | null {
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

export function findGeminiSendButton(): HTMLButtonElement | null {
  return queryGeminiSendButton();
}

export async function waitForGeminiEnabledSendButton(
  timeoutMs: number,
  editable?: HTMLElement
): Promise<HTMLButtonElement | null> {
  return waitFor(() => {
    const b =
      (editable ? queryGeminiSendButtonNearEditor(editable) : null) ??
      queryGeminiSendButton();
    if (!b || isGeminiSendButtonDisabled(b)) return null;
    return b;
  }, timeoutMs);
}

/** Phase: submit — pointer synthesis + Enter for Angular Material. */
export async function submitGeminiComposer(
  editable: HTMLElement,
  btn: HTMLButtonElement
): Promise<void> {
  editable.focus();
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
