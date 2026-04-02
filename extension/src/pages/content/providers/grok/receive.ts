import { GROK_MSG_IN, GROK_SRC_CONTENT } from "./constants";
import { runGrokAsk } from "./runAsk";

export function registerGrokReceiveListener(): void {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as {
      source?: string;
      type?: string;
      text?: string;
    } | null;
    if (!d || d.source !== GROK_SRC_CONTENT || d.type !== GROK_MSG_IN) return;
    const t = typeof d.text === "string" ? d.text : "";
    void runGrokAsk(t);
  });
}
