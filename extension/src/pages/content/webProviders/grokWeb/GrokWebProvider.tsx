import { useEffect, useRef } from "react";
import { scheduleFreshChatIfTurnLimitReached } from "../../shared/threadRefresh";
import type {
  AskQuestionPayload,
  QuestionAnswerPayload,
} from "../../shared/relayTypes";

const CONTENT_SOURCE = "bridgegpt-content-script";
const RUN_TYPE = "bridgegpt_grok_run";

export const GrokWebProvider = () => {
  console.log("[BridgeGPT] Grok provider loaded");

  const lastRelayRef = useRef<{ route: string; body: unknown } | null>(null);
  const pageScriptReadyRef = useRef(false);

  const runLastScript = (payload: unknown) => {
    if (payload === null || payload === undefined) return;

    const base: QuestionAnswerPayload =
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload)
        ? { ...(payload as QuestionAnswerPayload) }
        : { assistantText: String(payload), version: 1 };

    const hasAssistant =
      typeof base.assistantText === "string" &&
      base.assistantText.trim() !== "";

    if (!hasAssistant && typeof base.capture !== "object") {
      return;
    }

    base.extensionMeta = {
      contentScriptCapturedAt: new Date().toISOString(),
    };

    const relay = lastRelayRef.current;
    if (relay) {
      base.relayRequest = { route: relay.route, body: relay.body };
    }

    chrome.runtime.sendMessage(
      { type: "question_answer", content: base },
      () => {
        void chrome.runtime.lastError;
        scheduleFreshChatIfTurnLimitReached("grok", hasAssistant);
      }
    );
  };

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const { data } = (event.data || {}) as { data?: unknown };
      if (data && typeof data === "object" && data !== null) {
        const src = (data as { source?: unknown }).source;
        if (src !== "bridgegpt-grok-page") return;
      }
      runLastScript(data);
    };

    const onRuntimeMessage = (
      msg: { type?: string; content?: AskQuestionPayload },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r?: unknown) => void
    ): boolean => {
      if (msg.type !== "ask_question" || !msg.content) {
        return false;
      }
      if (!pageScriptReadyRef.current) {
        sendResponse({ ok: false, reason: "grok_page_script_not_ready" });
        return false;
      }
      const c = msg.content;
      lastRelayRef.current = { route: c.route, body: c.body };
      const text =
        typeof c.promptForChatgpt === "string" ? c.promptForChatgpt.trim() : "";
      if (!text) {
        sendResponse({ ok: false, reason: "missing_prompt_from_relay" });
        return false;
      }

      window.postMessage(
        { source: CONTENT_SOURCE, type: RUN_TYPE, text },
        "*"
      );
      sendResponse({ ok: true });
      return false;
    };

    chrome.runtime.onMessage.addListener(onRuntimeMessage);

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("grok-page.js");
    document.body.appendChild(script);
    script.onload = () => {
      pageScriptReadyRef.current = true;
      window.addEventListener("message", onWindowMessage);
    };

    return () => {
      window.removeEventListener("message", onWindowMessage);
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    };
  }, []);

  return <div />;
};
