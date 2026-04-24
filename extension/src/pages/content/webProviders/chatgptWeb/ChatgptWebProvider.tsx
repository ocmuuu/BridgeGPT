import { useEffect, useRef } from "react";
import { scheduleFreshChatIfTurnLimitReached } from "../../shared/threadRefresh";
import type {
  AskQuestionPayload,
  QuestionAnswerPayload,
} from "../../shared/relayTypes";

/**
 * Content side of ChatGPT: Receive (`ask_question`) → queue → postMessage →
 * page runs Resolve/Fill/Submit + DOM-poll → Emit via postMessage back.
 *
 * The content-script queue (queueRef / processingRef) ensures:
 *   1. At most one request is forwarded to the page world at a time.
 *   2. Duplicate texts (relay retry / Socket.IO re-deliver) are ignored
 *      if the same text is already being processed or is queued.
 *   3. The next request only starts AFTER the current result is delivered
 *      to the relay (inside the chrome.runtime.sendMessage callback).
 *
 * @see `../../shared/providerPhaseModel.ts` — phase definitions.
 */
export type { QuestionAnswerPayload };

/** Must match `chatgpt-page.ts` (page world). */
const PAGE_SCRIPT_SOURCE = "bridgegpt-chatgpt-page";
const CONTENT_SOURCE = "bridgegpt-content-script";
const RUN_TYPE = "bridgegpt_chatgpt_run";

type PendingAsk = { text: string; route: string; body: unknown };

export const ChatgptWebProvider = () => {
  const pageScriptReadyRef = useRef(false);
  const currentRelayRef = useRef<{ route: string; body: unknown } | null>(null);

  /** Serial request queue — entries are dequeued one at a time. */
  const queueRef = useRef<PendingAsk[]>([]);
  const processingRef = useRef(false);
  const currentTextRef = useRef<string | null>(null);

  useEffect(() => {
    /** Shift the next item from the queue and forward it to the page world. */
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

    /** Handle the result message from the page world and advance the queue. */
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const { data } = (event.data || {}) as { data?: unknown };
      if (!data || typeof data !== "object" || data === null) return;
      const src = (data as { source?: unknown }).source;
      if (src !== PAGE_SCRIPT_SOURCE) return;

      const payload = data as Record<string, unknown>;
      const base: QuestionAnswerPayload = { ...(payload as QuestionAnswerPayload) };

      if (
        typeof base.assistantText === "string" &&
        base.assistantText.trim() === "" &&
        typeof base.capture !== "object"
      ) {
        processNext();
        return;
      }

      base.extensionMeta = {
        contentScriptCapturedAt: new Date().toISOString(),
      };
      const relay = currentRelayRef.current;
      if (relay) base.relayRequest = { route: relay.route, body: relay.body };

      const hadNonEmptyAssistant =
        typeof base.assistantText === "string" &&
        base.assistantText.trim() !== "";

      chrome.runtime.sendMessage(
        { type: "question_answer", content: base },
        () => {
          void chrome.runtime.lastError;
          scheduleFreshChatIfTurnLimitReached("chatgpt", hadNonEmptyAssistant);
          processNext(); // advance queue only after result is delivered
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
        sendResponse({ ok: false, reason: "chatgpt_page_script_not_ready" });
        return false;
      }
      const c = msg.content;
      const text =
        typeof c.promptForChatgpt === "string" ? c.promptForChatgpt.trim() : "";
      if (!text) {
        sendResponse({ ok: false, reason: "missing_prompt_from_relay" });
        return false;
      }

      // Deduplicate: skip if same text is already processing or queued
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

    const scriptSrc = chrome.runtime.getURL("chatgpt-page.js");
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
