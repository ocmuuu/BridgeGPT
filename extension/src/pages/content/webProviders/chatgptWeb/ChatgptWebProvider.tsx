import { useEffect, useRef } from "react";
import type {
  AskQuestionPayload,
  QuestionAnswerPayload,
} from "../../shared/relayTypes";

export type { QuestionAnswerPayload };

/** Page script `chatgpt-page.js` sets this on captured payloads (see `chatgpt-page.ts`). */
const PAGE_SCRIPT_SOURCE = "bridgegpt-chatgpt-page";

export const ChatgptWebProvider = () => {
  console.log("[BridgeGPT] ChatGPT provider loaded");

  const lastRelayRef = useRef<{ route: string; body: unknown } | null>(null);

  const runLastScript = (payload: unknown) => {
    if (payload === null || payload === undefined) return;

    const base: QuestionAnswerPayload =
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload)
        ? { ...(payload as QuestionAnswerPayload) }
        : { assistantText: String(payload), version: 1 };

    if (
      typeof base.assistantText === "string" &&
      base.assistantText.trim() === "" &&
      typeof base.capture !== "object"
    ) {
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
      () => void chrome.runtime.lastError
    );
  };

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const { data } = (event.data || {}) as { data?: unknown };
      if (data && typeof data === "object" && data !== null) {
        const src = (data as { source?: unknown }).source;
        if (src !== PAGE_SCRIPT_SOURCE) return;
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
      const c = msg.content;
      lastRelayRef.current = { route: c.route, body: c.body };
      const inputElement = document.querySelector(
        '[name="prompt-textarea"]'
      ) as HTMLInputElement;
      const contentArea = document.querySelector(
        "#prompt-textarea"
      ) as HTMLDivElement;
      if (!inputElement || !contentArea) {
        sendResponse({ ok: false, reason: "dom_not_ready" });
        return false;
      }
      const text =
        typeof c.promptForChatgpt === "string" ? c.promptForChatgpt.trim() : "";
      if (!text) {
        sendResponse({ ok: false, reason: "missing_prompt_from_relay" });
        return false;
      }
      contentArea.innerHTML = text;
      inputElement.value = text;
      window.setTimeout(() => {
        const submitButton = document.querySelector(
          "#composer-submit-button"
        ) as HTMLButtonElement;
        submitButton?.click();
      }, 100);
      sendResponse({ ok: true });
      return false;
    };

    chrome.runtime.onMessage.addListener(onRuntimeMessage);

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("chatgpt-page.js");
    document.body.appendChild(script);
    script.onload = () => {
      window.addEventListener("message", onWindowMessage);
    };

    return () => {
      window.removeEventListener("message", onWindowMessage);
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    };
  }, []);

  return <div />;
};
