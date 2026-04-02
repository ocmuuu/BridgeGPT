import { GROK_SRC_PAGE } from "./constants";

export function grokPostToContent(payload: Record<string, unknown>): void {
  window.postMessage(
    {
      data: {
        version: 1,
        source: GROK_SRC_PAGE,
        ...payload,
      },
    },
    "*"
  );
}
