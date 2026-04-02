import { isInHiddenAncestor, isProbablyVisible } from "./domHelpers";

/** Phase: resolve_composer — textarea vs ProseMirror in main. */

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
    if (
      pm instanceof HTMLElement &&
      isProbablyVisible(pm) &&
      !isInHiddenAncestor(pm)
    ) {
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

export type GrokComposerPick = {
  el: HTMLElement;
  kind: "textarea" | "prose";
  form: HTMLFormElement | null;
};

export function pickGrokComposer(): GrokComposerPick | null {
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
