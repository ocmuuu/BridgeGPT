import { useEffect, useRef } from "react";
import { scheduleFreshChatIfTurnLimitReached } from "../../shared/threadRefresh";
import type {
  AskQuestionPayload,
  QuestionAnswerPayload,
} from "../../shared/relayTypes";

/**
 * Content side of Grok — same content-script queue pattern as ChatGPT:
 * deduplicate, serialize, advance only after result is delivered.
 *
 * @see `../../shared/providerPhaseModel.ts` — phase definitions.
 */
const PAGE_SCRIPT_SOURCE = "bridgegpt-grok-page";
const CONTENT_SOURCE = "bridgegpt-content-script";
const RUN_TYPE = "bridgegpt_grok_run";

type PendingAsk = { text: string; route: string; body: unknown };

export const GrokWebProvider = () => {
  const pageScriptReadyRef = useRef(false);
  const currentRelayRef = useRef<{ route: string; body: unknown } | null>(null);
  const queueRef = useRef<PendingAsk[]>([]);
  const processingRef = useRef(false);
  const currentTextRef = useRef<string | null>(null);

  useEffect(() => {
    const processNext = () => {
      const next = queueRef.current.shift();
      if (!next) {
        processingRef.current = false;
        currentTextRef.current = null;
        return;
      }
      processingRef.current = true;
      currentTextRef.current = next.text;
      currentRelayRef.current = { route: next.route, body: next.body };
      window.postMessage(
        { source: CONTENT_SOURCE, type: RUN_TYPE, text: next.text },
        "*"
      );
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const { data } = (event.data || {}) as { data?: unknown };
      if (!data || typeof data !== "object" || data === null) return;
      const src = (data as { source?: unknown }).source;
      if (src !== PAGE_SCRIPT_SOURCE) return;

      const base: QuestionAnswerPayload = {
        ...(data as QuestionAnswerPayload),
      };

      const hasAssistant =
        typeof base.assistantText === "string" &&
        base.assistantText.trim() !== "";

      if (!hasAssistant && typeof base.capture !== "object") {
        processNext();
        return;
      }

      base.extensionMeta = {
        contentScriptCapturedAt: new Date().toISOString(),
      };
      const relay = currentRelayRef.current;
      if (relay) base.relayRequest = { route: relay.route, body: relay.body };

      chrome.runtime.sendMessage(
        { type: "question_answer", content: base },
        () => {
          void chrome.runtime.lastError;
          scheduleFreshChatIfTurnLimitReached("grok", hasAssistant);
          processNext();
        }
      );
    };

    const onRuntimeMessage = (
      msg: { type?: string; content?: AskQuestionPayload },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r?: unknown) => void
    ): boolean => {
      if (msg.type !== "ask_question" || !msg.content) return false;
      if (!pageScriptReadyRef.current) {
        sendResponse({ ok: false, reason: "grok_page_script_not_ready" });
        return false;
      }
      const c = msg.content;
      const text =
        typeof c.promptForChatgpt === "string" ? c.promptForChatgpt.trim() : "";
      if (!text) {
        sendResponse({ ok: false, reason: "missing_prompt_from_relay" });
        return false;
      }

      const alreadyActive = text === currentTextRef.current;
      const alreadyQueued = queueRef.current.some((r) => r.text === text);
      if (!alreadyActive && !alreadyQueued) {
        queueRef.current.push({ text, route: c.route, body: c.body });
      }

      if (!processingRef.current) processNext();
      sendResponse({ ok: true });
      return false;
    };

    chrome.runtime.onMessage.addListener(onRuntimeMessage);

    const scriptSrc = chrome.runtime.getURL("grok-page.js");
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CSS.escape(scriptSrc)}"]`
    );
    if (existing) {
      pageScriptReadyRef.current = true;
      window.addEventListener("message", onWindowMessage);
    } else {
      const script = document.createElement("script");
      script.src = scriptSrc;
      document.body.appendChild(script);
      script.onload = () => {
        pageScriptReadyRef.current = true;
        window.addEventListener("message", onWindowMessage);
      };
    }

    return () => {
      window.removeEventListener("message", onWindowMessage);
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    };
  }, []);

  return <div />;
};
