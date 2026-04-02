/** Phase: wait_capture — Gemini conversation / model-response DOM. */

export type GeminiAssistantCapture = {
  assistantHtml: string;
  assistantText: string;
};

function assistantRootToCapture(root: HTMLElement): GeminiAssistantCapture {
  return {
    assistantHtml: root.innerHTML?.trim() ?? "",
    assistantText: root.innerText?.trim() ?? "",
  };
}

export function geminiCaptureKey(c: GeminiAssistantCapture): string {
  return c.assistantHtml || c.assistantText;
}

function resolveAssistantMarkdownPanel(el: HTMLElement): HTMLElement | null {
  if (el.classList.contains("markdown")) return el;
  const inner = el.querySelector(
    '.markdown[aria-live="polite"], .markdown.markdown-main-panel, message-content .markdown, .markdown'
  );
  return inner instanceof HTMLElement ? inner : null;
}

function lastNonEmptyAssistantCapture(
  nodes: Iterable<Element>
): GeminiAssistantCapture {
  const empty: GeminiAssistantCapture = { assistantHtml: "", assistantText: "" };
  const list = Array.from(nodes);
  for (let i = list.length - 1; i >= 0; i--) {
    const el = list[i];
    if (!(el instanceof HTMLElement)) continue;
    const panel = resolveAssistantMarkdownPanel(el);
    if (!panel) continue;
    const cap = assistantRootToCapture(panel);
    if (geminiCaptureKey(cap)) return cap;
  }
  return empty;
}

export function normalizeGeminiChatPrompt(s: string): string {
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

function findConversationForPrompt(prompt: string): Element | null {
  const want = normalizeGeminiChatPrompt(prompt);
  if (!want) return null;
  const containers = document.querySelectorAll("div.conversation-container");
  for (let i = containers.length - 1; i >= 0; i--) {
    const c = containers[i];
    const got = normalizeGeminiChatPrompt(userQueryTextFromConversation(c));
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

export function collectGeminiModelReplyForPrompt(
  prompt: string
): GeminiAssistantCapture {
  const empty: GeminiAssistantCapture = { assistantHtml: "", assistantText: "" };
  const c = findConversationForPrompt(prompt);
  if (!c) return empty;
  const mr = c.querySelector("model-response");
  if (!mr) return empty;
  const root = assistantMarkdownRoot(mr);
  return root instanceof HTMLElement ? assistantRootToCapture(root) : empty;
}

export function isGeminiMarkdownIdleForPrompt(prompt: string): boolean {
  const c = findConversationForPrompt(prompt);
  if (!c) return false;
  const mr = c.querySelector("model-response");
  if (!mr) return false;
  const root = assistantMarkdownRoot(mr);
  if (!(root instanceof HTMLElement)) return false;
  return root.getAttribute("aria-busy") !== "true";
}

export function collectGeminiModelReplyGlobal(): GeminiAssistantCapture {
  const chains: string[] = [
    'model-response .markdown[aria-live="polite"]',
    "model-response message-content",
    '[class*="model-response-text"] .markdown[aria-live="polite"]',
    '[class*="model-response-text"] message-content',
    'message-content[class*="model-response"]',
  ];
  for (const sel of chains) {
    const cap = lastNonEmptyAssistantCapture(document.querySelectorAll(sel));
    if (geminiCaptureKey(cap)) return cap;
  }
  const shells = document.querySelectorAll('[class*="model-response-text"]');
  const fromShell = lastNonEmptyAssistantCapture(shells);
  if (geminiCaptureKey(fromShell)) return fromShell;
  return lastNonEmptyAssistantCapture(
    document.querySelectorAll("message-content")
  );
}
