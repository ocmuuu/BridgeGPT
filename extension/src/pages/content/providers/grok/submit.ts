import {
  isInHiddenAncestor,
  isProbablyVisible,
  sleep,
  waitForPaintTick,
} from "./domHelpers";

function findVisibleSubmitButton(
  form: HTMLFormElement | null
): HTMLButtonElement | null {
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

/** Phase: submit — visible button or Mod+Enter / Enter. */
export async function submitGrokFilled(
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
