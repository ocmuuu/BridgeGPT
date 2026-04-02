import { isProbablyVisible, lastMatchingElement } from "./domHelpers";

/**
 * Phase: resolve_composer — Gemini Quill / rich-textarea (light + shadow DOM).
 */
export function findGeminiEditableRoot(): HTMLElement | null {
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
