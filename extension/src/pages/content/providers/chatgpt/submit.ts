import { sleep, waitFor, waitForPaintTick } from "./domHelpers";

function queryChatgptSubmitButton(): HTMLButtonElement | null {
  const byId = document.querySelector("#composer-submit-button");
  if (byId instanceof HTMLButtonElement) return byId;
  const fallback = document.querySelector(
    'button[data-testid="composer-submit-button"]'
  );
  return fallback instanceof HTMLButtonElement ? fallback : null;
}

function isChatgptSubmitButtonDisabled(btn: HTMLButtonElement): boolean {
  if (btn.disabled) return true;
  if (btn.getAttribute("aria-disabled") === "true") return true;
  return false;
}

/** Returns true if the button is the Stop-generation button rather than Send. */
function isChatgptStopButton(btn: HTMLButtonElement): boolean {
  const label = (btn.getAttribute("aria-label") ?? "").toLowerCase();
  return (
    label.includes("stop") ||
    label.includes("停") ||
    label.includes("中止") ||
    btn.getAttribute("data-testid") === "stop-button"
  );
}

async function waitForEnabledSubmitButton(
  timeoutMs: number
): Promise<HTMLButtonElement | null> {
  return waitFor(() => {
    const b = queryChatgptSubmitButton();
    if (!b || isChatgptSubmitButtonDisabled(b)) return null;
    if (isChatgptStopButton(b)) return null;
    return b;
  }, timeoutMs);
}

async function clickChatgptSubmitButton(btn: HTMLButtonElement): Promise<void> {
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

/** Phase: submit — wait for enabled Send button (never clicks Stop). */
export async function submitChatgptComposer(): Promise<boolean> {
  await sleep(100);
  const btn =
    (await waitForEnabledSubmitButton(8000)) ?? queryChatgptSubmitButton();
  if (!btn || isChatgptSubmitButtonDisabled(btn) || isChatgptStopButton(btn))
    return false;
  await clickChatgptSubmitButton(btn);
  return true;
}
