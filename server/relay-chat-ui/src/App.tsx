import { useCallback, useEffect, useRef, useState } from "react";

import { Composer } from "./components/Composer";
import { MessageList, type ChatMessage } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import { getCookie, setCookie } from "./lib/cookies";
import { readSseStream } from "./lib/sse";
import {
  buildOrUpdateSession,
  deleteSession,
  loadRelayChatState,
  saveRelayChatState,
  type StoredConversation,
  type StoredTurn,
} from "./storage/conversationStorage";
import type { RelayChatBoot } from "./types/boot";

const SS_BACKEND = "bridgegpt_relay_chat_backend";
const SS_MODEL_OPENAI = "bridgegpt_relay_chat_model_openai";
const SS_MODEL_GEMINI = "bridgegpt_relay_chat_model_gemini";

function ssGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}

function ssSet(k: string, v: string): void {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

function pickInitialBackend(boot: RelayChatBoot): "openai" | "gemini" {
  const fromSs = ssGet(SS_BACKEND);
  if (fromSs === "gemini" || fromSs === "openai") return fromSs;
  return boot.backend === "gemini" ? "gemini" : "openai";
}

function pickModelForBackend(
  backend: "openai" | "gemini",
  boot: RelayChatBoot
): string {
  const list = backend === "openai" ? boot.openaiModels : boot.geminiModels;
  const saved =
    backend === "openai" ? ssGet(SS_MODEL_OPENAI) : ssGet(SS_MODEL_GEMINI);
  const def = backend === "openai" ? boot.model : boot.geminiModel;
  let pick = saved || def;
  if (!list.includes(pick)) pick = list[0]!;
  return pick;
}

function coerceModelForBackend(
  backend: "openai" | "gemini",
  saved: string,
  boot: RelayChatBoot
): string {
  const list = backend === "openai" ? boot.openaiModels : boot.geminiModels;
  if (saved && list.includes(saved)) return saved;
  return list[0]!;
}

function newConversationId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function messagesToTurns(messages: ChatMessage[]): StoredTurn[] {
  return messages.map((m) => {
    if (m.role === "user") {
      return { role: "user", content: m.content };
    }
    const turn: StoredTurn = { role: "assistant", content: m.content };
    if (m.sourceBackend) {
      turn.backend = m.sourceBackend;
      turn.model = m.sourceModel ?? "";
    }
    return turn;
  });
}

function turnsToChatMessages(
  turns: StoredTurn[],
  fallback: { backend: "openai" | "gemini"; model: string }
): ChatMessage[] {
  return turns.map((t) => {
    if (t.role === "user") {
      return {
        id: crypto.randomUUID(),
        role: "user",
        content: t.content,
      };
    }
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: t.content,
      sourceBackend: t.backend ?? fallback.backend,
      sourceModel: t.model ?? fallback.model,
    };
  });
}

type Props = { boot: RelayChatBoot };

export default function App({ boot }: Props) {
  const [apiKey, setApiKeyState] = useState("");
  const [fromUrlKey, setFromUrlKey] = useState(false);
  const [backend, setBackend] = useState(() => pickInitialBackend(boot));
  const [model, setModel] = useState(() =>
    pickModelForBackend(pickInitialBackend(boot), boot)
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState(() =>
    newConversationId()
  );
  const [input, setInput] = useState(boot.initialUserMessage || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const hasApiKey = Boolean(apiKey.trim());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = (params.get("api_key") || params.get("apikey") || "").trim();
    let key = fromUrl;
    if (fromUrl) {
      setCookie(boot.cookieName, fromUrl);
      params.delete("api_key");
      params.delete("apikey");
      const qs = params.toString();
      history.replaceState(
        null,
        "",
        location.pathname + (qs ? `?${qs}` : "") + location.hash
      );
      setFromUrlKey(true);
    } else {
      key = getCookie(boot.cookieName).trim();
      setFromUrlKey(false);
    }
    setApiKeyState(key);
  }, [boot.cookieName]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("message")) return;
    params.delete("message");
    const qs = params.toString();
    history.replaceState(
      null,
      "",
      location.pathname + (qs ? `?${qs}` : "") + location.hash
    );
  }, []);

  useEffect(() => {
    if (!hasApiKey) return;
    let cancelled = false;
    void loadRelayChatState().then((st) => {
      if (cancelled) return;
      if (!st) return;
      setSessions(st.sessions);
      const aid = st.activeConversationId;
      if (aid) setActiveConversationId(aid);
      if (!aid && st.sessions.length === 0) {
        setActiveConversationId(newConversationId());
        return;
      }
      const cur = aid
        ? st.sessions.find((s) => s.id === aid)
        : undefined;
      if (cur) {
        setBackend(cur.backend);
        setModel(coerceModelForBackend(cur.backend, cur.model, boot));
        if (cur.turns.length) {
          setMessages(
            turnsToChatMessages(cur.turns, {
              backend: cur.backend,
              model: cur.model,
            })
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasApiKey, boot]);

  useEffect(() => {
    if (!hasApiKey) return;
    if (messages.some((m) => m.streaming)) return;
    const turns = messagesToTurns(messages);
    if (turns.length === 0) return;
    const t = window.setTimeout(() => {
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === activeConversationId);
        const updated = buildOrUpdateSession(existing, {
          id: activeConversationId,
          turns,
          backend,
          model,
        });
        const others = prev.filter((s) => s.id !== activeConversationId);
        const next = [...others, updated].sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
        void saveRelayChatState({
          sessions: next,
          activeConversationId,
        });
        return next;
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [hasApiKey, messages, activeConversationId, backend, model]);

  const onBackendChange = (b: "openai" | "gemini") => {
    setBackend(b);
    ssSet(SS_BACKEND, b);
    setModel(pickModelForBackend(b, boot));
  };

  const onModelChange = (m: string) => {
    setModel(m);
    if (backend === "openai") ssSet(SS_MODEL_OPENAI, m);
    else ssSet(SS_MODEL_GEMINI, m);
  };

  const onNewChat = async () => {
    setMessages([]);
    setError("");
    const newId = newConversationId();
    setActiveConversationId(newId);
    await saveRelayChatState({
      sessions: sessionsRef.current,
      activeConversationId: newId,
    });
  };

  const onSelectSession = (id: string) => {
    if (id === activeConversationId) return;
    const s = sessionsRef.current.find((x) => x.id === id);
    if (!s) return;
    setActiveConversationId(id);
    setBackend(s.backend);
    setModel(coerceModelForBackend(s.backend, s.model, boot));
    setMessages(
      turnsToChatMessages(s.turns, { backend: s.backend, model: s.model })
    );
    setError("");
    void saveRelayChatState({
      sessions: sessionsRef.current,
      activeConversationId: id,
    });
  };

  const onDeleteSession = async (id: string) => {
    const next = await deleteSession(
      { sessions: sessionsRef.current, activeConversationId },
      id
    );
    setSessions(next.sessions);
    let aid = next.activeConversationId;
    if (!next.sessions.length) {
      aid = newConversationId();
      setActiveConversationId(aid);
      setMessages([]);
      await saveRelayChatState({
        sessions: [],
        activeConversationId: aid,
      });
      return;
    }
    if (!aid) {
      aid = newConversationId();
      setActiveConversationId(aid);
      setMessages([]);
      await saveRelayChatState({
        sessions: next.sessions,
        activeConversationId: aid,
      });
      return;
    }
    setActiveConversationId(aid);
    const cur = next.sessions.find((s) => s.id === aid);
    if (cur) {
      setBackend(cur.backend);
      setModel(coerceModelForBackend(cur.backend, cur.model, boot));
      setMessages(
        turnsToChatMessages(cur.turns, {
          backend: cur.backend,
          model: cur.model,
        })
      );
    }
  };

  const send = useCallback(async () => {
    const t = input.trim();
    const key = apiKey.trim();
    if (!t || !key || busy) return;
    const userId = crypto.randomUUID();
    const asstId = crypto.randomUUID();
    setInput("");
    setError("");
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: t },
      {
        id: asstId,
        role: "assistant",
        content: "",
        streaming: true,
        sourceBackend: backend,
        sourceModel: model,
      },
    ]);
    setBusy(true);
    try {
      let res: Response;
      if (backend === "gemini") {
        const mid = encodeURIComponent(model);
        res = await fetch(`/v1beta/models/${mid}:streamGenerateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: t }] }],
          }),
        });
      } else {
        res = await fetch("/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: t }],
            stream: true,
          }),
        });
      }

      if (!res.ok) {
        let errText = await res.text();
        try {
          const j = JSON.parse(errText) as {
            error?: { message?: string; status?: string; code?: string };
          };
          errText =
            j.error?.message ||
            (j.error?.code != null ? String(j.error.code) : "") ||
            errText;
        } catch {
          /* keep text */
        }
        setError(`Request failed (${res.status}): ${errText}`);
        setMessages((prev) => prev.filter((m) => m.id !== asstId));
        return;
      }

      const full = await readSseStream(
        res,
        boot.sseBlockSep,
        boot.sseLineSep,
        backend,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, content: delta } : m))
          );
        }
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: full, streaming: false }
            : m
        )
      );
    } catch (e) {
      setError(String((e as Error)?.message || e));
      setMessages((prev) => {
        const asst = prev.find((m) => m.id === asstId);
        const empty = !String(asst?.content || "").trim();
        if (empty) return prev.filter((m) => m.id !== asstId);
        return prev.map((m) =>
          m.id === asstId ? { ...m, streaming: false } : m
        );
      });
    } finally {
      setBusy(false);
    }
  }, [
    apiKey,
    backend,
    boot.sseBlockSep,
    boot.sseLineSep,
    busy,
    input,
    model,
  ]);

  return (
    <div className="app-shell">
      <Sidebar
        boot={boot}
        hasApiKey={hasApiKey}
        fromUrlKey={fromUrlKey}
        backend={backend}
        onBackendChange={onBackendChange}
        model={model}
        onModelChange={onModelChange}
        onNewChat={onNewChat}
        busy={busy}
        sessions={sessions}
        activeConversationId={activeConversationId}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
      />
      <main className="main-panel">
        <div className="main-local-notice" role="note">
          <span className="main-local-notice-icon" aria-hidden>
            ●
          </span>
          <p className="main-local-notice-text">
            <strong>Local only.</strong> Conversation history stays in this
            browser (Chrome local storage / Local Storage). This relay server
            does not persist your chats.
          </p>
        </div>
        <MessageList messages={messages} logoUrl={boot.logoUrl} />
        {error ? (
          <div className="main-error" role="alert">
            {error}
          </div>
        ) : null}
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void send()}
          disabled={!hasApiKey}
          busy={busy}
          placeholder={
            hasApiKey
              ? "Message…"
              : "Open from BridgeGPT extension Settings…"
          }
        />
      </main>
    </div>
  );
}
