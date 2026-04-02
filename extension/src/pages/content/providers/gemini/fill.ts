/** Phase: fill — Gemini Trusted Types–safe Quill body fill. */
export function fillGeminiQuillEditor(editable: HTMLElement, text: string): void {
  editable.focus();
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
