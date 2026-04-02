import { CHATGPT_SRC_PAGE } from "./constants";

/** Phase: emit (failure path before SSE). */
export function postChatgptRunAskFailure(
  reason: string,
  startedAt: string
): void {
  window.postMessage(
    {
      data: {
        version: 1,
        source: CHATGPT_SRC_PAGE,
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
      },
    },
    "*"
  );
}
