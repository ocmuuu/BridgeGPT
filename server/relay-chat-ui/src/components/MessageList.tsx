import { useEffect, useRef } from "react";

import { AssistantMarkdown } from "./AssistantMarkdown.js";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Assistant only: stream not finished → render plain text */
  streaming?: boolean;
  /** Assistant: backend & model used for this reply */
  sourceBackend?: "openai" | "gemini";
  sourceModel?: string;
};

function assistantSourceLabel(
  backend: "openai" | "gemini",
  model: string
): string {
  const platform =
    backend === "openai" ? "ChatGPT · OpenAI" : "Gemini · Google";
  const m = model.trim();
  return m ? `${platform} · ${m}` : platform;
}

type Props = { messages: ChatMessage[]; logoUrl: string };

export function MessageList({ messages, logoUrl }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="message-scroll">
      <div className="message-inner">
        {messages.length === 0 && (
          <div className="empty-thread">
            <img
              className="empty-logo"
              src={logoUrl}
              alt=""
              width={72}
              height={72}
              decoding="async"
            />
            <h1 className="empty-title">BridgeGPT</h1>
            <p className="empty-sub">
              Messages relay to your signed-in ChatGPT or Gemini tab.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role}`}>
            <div className="msg-avatar" aria-hidden>
              {m.role === "user" ? "You" : "AI"}
            </div>
            <div className="msg-body">
              {m.role === "user" ? (
                <div className="bubble user-bubble whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <>
                  {m.streaming ? (
                    <div className="bubble assistant-bubble">
                      {!m.content.trim() ? (
                        <div
                          className="assistant-loading"
                          role="status"
                          aria-live="polite"
                          aria-label="Waiting for response"
                        >
                          <span
                            className="assistant-loading-spinner"
                            aria-hidden
                          />
                          <span className="assistant-loading-text">
                            Thinking…
                          </span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}
                    </div>
                  ) : (
                    <AssistantMarkdown
                      content={m.content}
                      className="assistant-bubble"
                    />
                  )}
                  {m.sourceBackend &&
                  (!m.streaming || m.content.trim()) ? (
                    <div className="msg-source" aria-label="Reply source">
                      {assistantSourceLabel(
                        m.sourceBackend,
                        m.sourceModel ?? ""
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
