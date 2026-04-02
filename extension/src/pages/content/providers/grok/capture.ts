/** Phase: wait_capture — `.response-content-markdown` + stability heuristics. */

import { pickGrokComposer } from "./resolveComposer";

function excludeComposerTree(): HTMLElement | null {
  const pick = pickGrokComposer();
  if (!pick) return null;
  if (pick.form) return pick.form;
  return pick.el.closest("footer");
}

function normalizeChat(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function isUserMessageMarkdown(el: HTMLElement): boolean {
  const row = el.closest('div[id^="response-"]');
  if (!(row instanceof HTMLElement)) return false;
  return row.classList.contains("items-end");
}

function isInsideThinkingUi(el: HTMLElement): boolean {
  return !!el.closest(".thinking-container");
}

export function isGrokAssistantBoilerplate(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const low = normalizeChat(t).toLowerCase();
  if (/^參考以下內容[:：]?\s*$/i.test(t)) return true;
  if (/^参考以下内容[:：]?\s*$/i.test(t)) return true;
  if (/^refer to the following content[:：]?\s*$/i.test(low)) return true;
  if (
    /user message only says/.test(low) &&
    /refer to the following/i.test(low)
  ) {
    return true;
  }
  if (/請提供您要我參考的內容/.test(t) && t.length < 200) return true;
  if (/请提供您要我参考的内容/.test(t) && t.length < 200) return true;
  if (
    /please provide (the )?content (you want|for me)/i.test(t) &&
    t.length < 200
  ) {
    return true;
  }
  return false;
}

export function collectGrokLatestAssistantPlain(promptNorm: string): string {
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
    if (isGrokAssistantBoilerplate(t)) continue;
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

export function isLikelyGrokPreviewSnippet(prompt: string, reply: string): boolean {
  if (reply.length >= 200) return false;
  const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(prompt);
  if (!hasCjk) return false;
  const nonWs = reply.replace(/\s/g, "");
  if (!nonWs.length) return false;
  const nonAsciiRatio =
    nonWs.replace(/[\u0000-\u007f]/g, "").length / nonWs.length;
  return nonAsciiRatio < 0.15 && reply.length < 180;
}

export function grokStableTicksNeeded(replyLen: number): number {
  if (replyLen < 80) return 12;
  if (replyLen < 240) return 8;
  return 4;
}

export { normalizeChat as normalizeGrokChat };
