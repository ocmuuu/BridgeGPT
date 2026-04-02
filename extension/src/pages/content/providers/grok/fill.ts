/** Phase: fill */

export function fillGrokTextarea(ta: HTMLTextAreaElement, text: string): void {
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

export function fillGrokProseMirror(el: HTMLElement, text: string): void {
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
