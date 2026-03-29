import { useEffect, useRef } from "react";

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return String(content ?? "");
}

/** Fallback when older relays omit promptForChatgpt (keep in sync with server buildPromptForChatgptWeb). */
function buildChatPromptFromApiBody(route: string, body: unknown): string {
  if (
    route === "/v1/chat/completions" &&
    body &&
    typeof body === "object" &&
    "messages" in body
  ) {
    const msgs = (body as { messages?: unknown }).messages;
    if (Array.isArray(msgs) && msgs.length > 0) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m || typeof m !== "object") continue;
        const role = String((m as { role?: string }).role ?? "").toLowerCase();
        if (role !== "user") continue;
        const text = normalizeMessageContent(
          (m as { content?: unknown }).content
        ).trim();
        if (text) return text;
      }
      const parts: string[] = [];
      for (const m of msgs) {
        if (!m || typeof m !== "object") continue;
        const text = normalizeMessageContent(
          (m as { content?: unknown }).content
        ).trim();
        if (text) parts.push(text);
      }
      if (parts.length > 0) return parts.join("\n\n");
    }
  }
  return `Route: ${route}\nPayload: ${JSON.stringify(body)}`;
}

type AskQuestionContent = {
  route: string;
  body: unknown;
  promptForChatgpt?: string;
};

export type QuestionAnswerPayload = Record<string, unknown>;

export const ChatGPT = () => {
  console.log("Chatgpt script loaded");

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
      runLastScript(data);
    };

    const onRuntimeMessage = (
      msg: { type?: string; content?: AskQuestionContent },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r?: unknown) => void
    ): boolean => {
      console.log("incoming message", msg);
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
        typeof c.promptForChatgpt === "string" && c.promptForChatgpt.length > 0
          ? c.promptForChatgpt
          : buildChatPromptFromApiBody(c.route, c.body);
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
    script.src = chrome.runtime.getURL("loader.js");
    document.body.appendChild(script);
    script.onload = () => {
      window.addEventListener("message", onWindowMessage);
    };

    return () => {
      window.removeEventListener("message", onWindowMessage);
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    };
  }, []);

  return <div></div>;
};
