import { CHATGPT_SRC_PAGE } from "./constants";

/** Phase: emit — postMessage envelope to content (`version` + `source` + payload). */
export function chatgptPostToContent(payload: Record<string, unknown>): void {
  window.postMessage(
    {
      data: {
        version: 1,
        source: CHATGPT_SRC_PAGE,
        ...payload,
      },
    },
    "*"
  );
}

/** Emit failure before SSE wait_capture (early resolve / submit exit). */
export function postChatgptRunAskFailure(
  reason: string,
  startedAt: string
): void {
  chatgptPostToContent({
    assistantText: "",
    page: {
      href: typeof location !== "undefined" ? location.href : "",
      title: typeof document !== "undefined" ? document.title : "",
    },
    capture: {
      startedAt,
      completedAt: new Date().toISOString(),
      ok: false,
      reason,
    },
  });
}
