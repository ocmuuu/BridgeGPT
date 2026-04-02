import { GEMINI_MSG_IN, GEMINI_SRC_CONTENT } from "./constants";
import { runGeminiAsk } from "./runAsk";

export function registerGeminiReceiveListener(): void {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as {
      source?: string;
      type?: string;
      text?: string;
    } | null;
    if (!d || d.source !== GEMINI_SRC_CONTENT || d.type !== GEMINI_MSG_IN) {
      return;
    }
    const text = typeof d.text === "string" ? d.text : "";
    void runGeminiAsk(text);
  });
}
