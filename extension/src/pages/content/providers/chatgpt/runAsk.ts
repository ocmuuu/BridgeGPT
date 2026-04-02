import { fillChatgptComposer } from "./fill";
import { scheduleSubmitChatgpt } from "./submit";
import { postChatgptRunAskFailure } from "./emitFailure";
import { resolveChatgptComposer } from "./resolveComposer";

/**
 * Phases: resolve_composer → fill → submit.
 * wait_capture = SSE in `waitCaptureSse.ts`; emit success there.
 */
export function runChatgptAsk(text: string): void {
  const startedAt = new Date().toISOString();
  const c = resolveChatgptComposer();
  if (!c) {
    postChatgptRunAskFailure("dom_not_ready", startedAt);
    return;
  }
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    postChatgptRunAskFailure("missing_prompt", startedAt);
    return;
  }
  fillChatgptComposer(c, trimmed);
  scheduleSubmitChatgpt(startedAt);
}
