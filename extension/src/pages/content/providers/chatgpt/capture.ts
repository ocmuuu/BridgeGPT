/** Phase: wait_capture — ChatGPT conversation turn DOM (`.markdown` panel). */

export type ChatgptAssistantCapture = {
  assistantHtml: string;
  assistantText: string;
};

const EMPTY_CAPTURE: ChatgptAssistantCapture = {
  assistantHtml: "",
  assistantText: "",
};

function normalizeAssistantText(text: string): string {
  return text.replace(/\u200b/g, "").trim();
}

function captureFromMarkdownRoot(root: HTMLElement): ChatgptAssistantCapture {
  const html = root.innerHTML?.trim() ?? "";
  const text = normalizeAssistantText(
    root.innerText || root.textContent || ""
  );
  return { assistantHtml: html, assistantText: text };
}

export function chatgptCaptureKey(c: ChatgptAssistantCapture): string {
  return c.assistantHtml || c.assistantText;
}

export function normalizeChatgptChatPrompt(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function assistantMarkdownRoot(messageEl: HTMLElement): HTMLElement | null {
  const md = messageEl.querySelector(".markdown");
  return md instanceof HTMLElement ? md : null;
}

function assistantMessageInSection(section: Element): HTMLElement | null {
  const el = section.querySelector('[data-message-author-role="assistant"]');
  return el instanceof HTMLElement ? el : null;
}

function assistantTurnRoot(messageEl: HTMLElement): Element {
  return (
    messageEl.closest(
      'section[data-turn="assistant"], section[data-testid^="conversation-turn-"], .agent-turn'
    ) ?? messageEl
  );
}

function hasAssistantResponseActions(root: Element): boolean {
  return !!root.querySelector(
    [
      'button[data-testid="copy-turn-action-button"]',
      'button[data-testid="good-response-turn-action-button"]',
      'button[data-testid="bad-response-turn-action-button"]',
    ].join(",")
  );
}

function userTextFromSection(section: Element): string {
  const userEl = section.querySelector('[data-message-author-role="user"]');
  if (!(userEl instanceof HTMLElement)) return "";
  return (userEl.textContent || "").trim();
}

type TurnPair = { user: Element; assistant: Element | null };

function findTurnSectionsForPrompt(prompt: string): TurnPair | null {
  const want = normalizeChatgptChatPrompt(prompt);
  if (!want) return null;
  const sections = Array.from(
    document.querySelectorAll('section[data-testid^="conversation-turn-"]')
  );
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    if (sec.getAttribute("data-turn") !== "user") continue;
    const got = normalizeChatgptChatPrompt(userTextFromSection(sec));
    if (!got) continue;
    const matches =
      got === want ||
      (want.length >= 4 && got.includes(want)) ||
      (got.length >= 4 && want.includes(got));
    if (!matches) continue;

    let assistant: Element | null = null;
    for (let j = i + 1; j < sections.length; j++) {
      const next = sections[j];
      if (next.getAttribute("data-turn") === "assistant") {
        assistant = next;
        break;
      }
    }
    return { user: sec, assistant };
  }
  return null;
}

function lastAssistantMarkdownRootInDocument(): HTMLElement | null {
  const nodes = document.querySelectorAll('[data-message-author-role="assistant"]');
  for (let i = nodes.length - 1; i >= 0; i--) {
    const el = nodes[i];
    if (!(el instanceof HTMLElement)) continue;
    const root = assistantMarkdownRoot(el);
    if (root) return root;
  }
  return null;
}

export function collectChatgptAssistantReplyForPrompt(
  prompt: string
): ChatgptAssistantCapture {
  const pair = findTurnSectionsForPrompt(prompt);
  if (!pair || !pair.assistant) return EMPTY_CAPTURE;
  const msgEl = assistantMessageInSection(pair.assistant);
  if (!msgEl) return EMPTY_CAPTURE;
  const root = assistantMarkdownRoot(msgEl);
  return root ? captureFromMarkdownRoot(root) : EMPTY_CAPTURE;
}

export function collectChatgptAssistantReplyGlobal(): ChatgptAssistantCapture {
  const root = lastAssistantMarkdownRootInDocument();
  return root ? captureFromMarkdownRoot(root) : EMPTY_CAPTURE;
}

/**
 * Response actions (copy / thumbs up / thumbs down) only render once ChatGPT
 * finalizes a turn; use their presence as a cheap "generation finished" signal.
 */
export function isChatgptAssistantIdleForPrompt(prompt: string): boolean {
  const pair = findTurnSectionsForPrompt(prompt);
  if (!pair || !pair.assistant) return false;
  const msgEl = assistantMessageInSection(pair.assistant);
  if (!msgEl) return false;
  const root = assistantTurnRoot(msgEl);
  return hasAssistantResponseActions(root);
}

export function isChatgptAssistantIdleGlobal(): boolean {
  const stopBtn = document.querySelector(
    '#composer-submit-button[aria-label*="停"], #composer-submit-button[aria-label*="Stop" i]'
  );
  if (stopBtn) return false;
  const streaming = document.querySelector(
    '[data-message-streaming="true"], [data-is-streaming="true"]'
  );
  if (streaming) return false;
  const assistantMessages = document.querySelectorAll(
    '[data-message-author-role="assistant"]'
  );
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const msgEl = assistantMessages[i];
    if (!(msgEl instanceof HTMLElement)) continue;
    const root = assistantTurnRoot(msgEl);
    return hasAssistantResponseActions(root);
  }
  return false;
}
