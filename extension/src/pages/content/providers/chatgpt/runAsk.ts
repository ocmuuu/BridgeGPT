import { sleep } from "./domHelpers";
import {
  chatgptCaptureKey,
  collectChatgptAssistantReplyForPrompt,
  collectChatgptAssistantReplyGlobal,
  isChatgptAssistantIdleGlobal,
  normalizeChatgptChatPrompt,
  type ChatgptAssistantCapture,
} from "./capture";
import { fillChatgptComposer } from "./fill";
import { chatgptPostToContent, postChatgptRunAskFailure } from "./emit";
import { resolveChatgptComposer } from "./resolveComposer";
import { submitChatgptComposer } from "./submit";

/**
 * Serial queue: each `runChatgptAsk` call is appended as a `.then()` so
 * concurrent relay requests are processed one-at-a-time in arrival order.
 */
let _runQueue: Promise<void> = Promise.resolve();

/**
 * Enqueues a ChatGPT ask. Returns immediately; actual work runs after any
 * in-flight request finishes.
 */
export function runChatgptAsk(text: string): void {
  _runQueue = _runQueue.then(() => _doRunChatgptAsk(text)).catch(() => {});
}

async function _doRunChatgptAsk(text: string): Promise<void> {
  const startedAt = new Date().toISOString();
  const captureBase: Record<string, unknown> = { startedAt };

  const composer = resolveChatgptComposer();
  if (!composer) {
    postChatgptRunAskFailure("dom_not_ready", startedAt);
    return;
  }
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    postChatgptRunAskFailure("missing_prompt", startedAt);
    return;
  }

  fillChatgptComposer(composer, trimmed);

  /**
   * Prefer prompt-based lookup (exact DOM match), but fall back to global
   * "latest assistant message" when the prompt contains markdown syntax
   * (backticks, asterisks, angle brackets) that ChatGPT renders as HTML
   * elements, causing textContent to differ from the raw submitted text.
   */
  const promptNorm = normalizeChatgptChatPrompt(trimmed);
  const pickCapture = (): ChatgptAssistantCapture => {
    if (promptNorm) {
      const byPrompt = collectChatgptAssistantReplyForPrompt(trimmed);
      if (chatgptCaptureKey(byPrompt)) return byPrompt;
    }
    return collectChatgptAssistantReplyGlobal();
  };
  const pickIdle = (): boolean => isChatgptAssistantIdleGlobal();

  const before = pickCapture();
  const beforeKey = chatgptCaptureKey(before);

  const submitted = await submitChatgptComposer();
  if (!submitted) {
    postChatgptRunAskFailure("no_submit_button", startedAt);
    return;
  }

  let lastKey = "";
  let lastCapture: ChatgptAssistantCapture = {
    assistantHtml: "",
    assistantText: "",
  };
  let stableTicks = 0;
  const maxTicks = 900;
  const pollMs = 200;

  for (let i = 0; i < maxTicks; i++) {
    await sleep(pollMs);
    const cap = pickCapture();
    const key = chatgptCaptureKey(cap);
    if (!key) continue;
    if (key === beforeKey) continue;
    if (key) lastCapture = cap;
    if (key === lastKey) stableTicks += 1;
    else {
      stableTicks = 0;
      lastKey = key;
    }
    const uiIdle = pickIdle();
    const needStable = uiIdle ? 3 : 8;
    if (stableTicks >= needStable && cap.assistantText.length > 0) {
      chatgptPostToContent({
        assistantHtml: cap.assistantHtml,
        assistantText: cap.assistantText,
        page: {
          href: typeof location !== "undefined" ? location.href : "",
          title: typeof document !== "undefined" ? document.title : "",
        },
        capture: {
          ...captureBase,
          completedAt: new Date().toISOString(),
          stableTicks,
          pollTicks: i,
          uiIdle,
        },
      });
      return;
    }
  }

  const finalCap = pickCapture();
  const use = chatgptCaptureKey(finalCap) ? finalCap : lastCapture;
  chatgptPostToContent({
    assistantHtml: use.assistantHtml,
    assistantText: use.assistantText,
    page: {
      href: typeof location !== "undefined" ? location.href : "",
      title: typeof document !== "undefined" ? document.title : "",
    },
    capture: {
      ...captureBase,
      completedAt: new Date().toISOString(),
      reason: "timeout_or_partial",
      pollTicks: maxTicks,
    },
  });
}
