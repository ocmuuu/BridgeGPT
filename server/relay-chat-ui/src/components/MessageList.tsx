import { useEffect, useRef } from "react";

import { useI18n } from "../i18n/I18nProvider.js";
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

type Props = {
  messages: ChatMessage[];
  logoUrl: string;
  hasApiKey?: boolean;
};

export function MessageList({
  messages,
  logoUrl,
  hasApiKey = true,
}: Props) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement>(null);

  function assistantSourceLabel(
    backend: "openai" | "gemini",
    model: string
  ): string {
    const platform =
      backend === "openai" ? t.platformOpenAI : t.platformGemini;
    const m = model.trim();
    return m ? `${platform} · ${m}` : platform;
  }

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
            <h1 className="empty-title">{t.emptyTitle}</h1>
            {hasApiKey ? (
              <p className="empty-sub">{t.emptySub}</p>
            ) : (
              <div className="empty-no-key-intro">
                <p className="empty-no-key-status">{t.emptyNoKeyStatus}</p>
                <p className="empty-no-key-how">{t.emptyNoKeyHow}</p>
              </div>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role}`}>
            <div className="msg-avatar" aria-hidden>
              {m.role === "user" ? t.you : t.ai}
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
                          aria-label={t.waitingResponse}
                        >
                          <span
                            className="assistant-loading-spinner"
                            aria-hidden
                          />
                          <span className="assistant-loading-text">
                            {t.thinking}
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
                    <div className="msg-source" aria-label={t.replySource}>
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
