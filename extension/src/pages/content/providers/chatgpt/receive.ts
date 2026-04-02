import { CHATGPT_MSG_IN, CHATGPT_SRC_CONTENT } from "./constants";
import { runChatgptAsk } from "./runAsk";

/** Phase: receive (page) — bridge from content `postMessage` to `runChatgptAsk`. */
export function registerChatgptReceiveListener(): void {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as {
      source?: string;
      type?: string;
      text?: string;
    } | null;
    if (!d || d.source !== CHATGPT_SRC_CONTENT || d.type !== CHATGPT_MSG_IN) {
      return;
    }
    const t = typeof d.text === "string" ? d.text : "";
    runChatgptAsk(t);
  });
}
