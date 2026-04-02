import { GEMINI_SRC_PAGE } from "./constants";

export function geminiPostToContent(payload: Record<string, unknown>): void {
  window.postMessage(
    {
      data: {
        version: 1,
        source: GEMINI_SRC_PAGE,
        ...payload,
      },
    },
    "*"
  );
}
