import { useCallback, useEffect, useRef, useState } from "react";

import { Composer } from "./components/Composer";
import { MessageList, type ChatMessage } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import { useI18n } from "./i18n/I18nProvider.js";
import { getCookie, setCookie } from "./lib/cookies";
import { formatRelayChatHttpError } from "./lib/relayHttpError";
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
/** Cookie: user dismissed the “local only” banner; ~10y Max-Age set on dismiss. */
const COOKIE_LOCAL_NOTICE_DISMISSED = "bridgegpt_relay_chat_local_notice_dismissed";
/** Cookie: desktop sidebar collapsed (`1` / `0`); ~10y Max-Age. Ignored on narrow viewports. */
const COOKIE_SIDEBAR_COLLAPSED = "bridgegpt_relay_chat_sidebar_collapsed";
const COOKIE_TEN_YEARS = 31536000 * 10;

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

function pickInitialBackend(
  boot: RelayChatBoot
): "openai" | "gemini" | "grok" {
  const fromSs = ssGet(SS_BACKEND);
  if (fromSs === "gemini" || fromSs === "openai" || fromSs === "grok") {
    return fromSs;
  }
  if (boot.backend === "gemini") return "gemini";
  if (boot.backend === "grok") return "grok";
  return "openai";
}

/** Default model from boot config for the active backend (no UI picker). */
function defaultModelForBackend(
  backend: "openai" | "gemini" | "grok",
  boot: RelayChatBoot
): string {
  const list =
    backend === "openai"
      ? boot.openaiModels
      : backend === "gemini"
        ? boot.geminiModels
        : boot.grokModels;
  const def =
    backend === "openai"
      ? boot.model
      : backend === "gemini"
        ? boot.geminiModel
        : boot.grokModel;
  if (def && list.includes(def)) return def;
  return list[0]!;
}

function newConversationId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const MOBILE_NAV_MQ = "(max-width: 767px)";

function useMobileNavLayout(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_NAV_MQ).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

function messagesToTurns(messages: ChatMessage[]): StoredTurn[] {
  return messages.map((m) => {
    if (m.role === "user") {
      const turn: StoredTurn = { role: "user", content: m.content };
      if (m.composerBackend) {
        turn.backend = m.composerBackend;
        turn.model = m.composerModel ?? "";
      }
      return turn;
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
  fallback: { backend: "openai" | "gemini" | "grok"; model: string }
): ChatMessage[] {
  return turns.map((t) => {
    if (t.role === "user") {
      return {
        id: crypto.randomUUID(),
        role: "user",
        content: t.content,
        ...(t.backend && t.model !== undefined
          ? { composerBackend: t.backend, composerModel: t.model }
          : {}),
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
  const { t } = useI18n();
  const [apiKey, setApiKeyState] = useState("");
  const [fromUrlKey, setFromUrlKey] = useState(false);
  const [backend, setBackend] = useState(() => pickInitialBackend(boot));
  const [model, setModel] = useState(() =>
    defaultModelForBackend(pickInitialBackend(boot), boot)
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
        setModel(defaultModelForBackend(cur.backend, boot));
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

  const onBackendChange = (b: "openai" | "gemini" | "grok") => {
    setBackend(b);
    ssSet(SS_BACKEND, b);
    setModel(defaultModelForBackend(b, boot));
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
      {
        id: userId,
        role: "user",
        content: t,
        composerBackend: backend,
        composerModel: model,
      },
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
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        };
        if (backend === "grok") {
          headers["X-Bridge-Provider"] = "grok";
        }
        res = await fetch("/v1/chat/completions", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: t }],
            stream: true,
          }),
        });
      }

      if (!res.ok) {
        const errBody = await res.text();
        setError(formatRelayChatHttpError(res.status, errBody));
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

  const [showLocalNotice, setShowLocalNotice] = useState(() => {
    return getCookie(COOKIE_LOCAL_NOTICE_DISMISSED) !== "1";
  });

  const isMobileNav = useMobileNavLayout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(
    () => getCookie(COOKIE_SIDEBAR_COLLAPSED) === "1"
  );

  useEffect(() => {
    if (!isMobileNav) setMobileNavOpen(false);
  }, [isMobileNav]);

  useEffect(() => {
    if (!isMobileNav || !mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileNav, mobileNavOpen]);

  useEffect(() => {
    if (!isMobileNav || !mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileNav, mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const afterMobileDrawerNav = useCallback(() => {
    if (isMobileNav) setMobileNavOpen(false);
  }, [isMobileNav]);

  const desktopSidebarHidden = !isMobileNav && desktopSidebarCollapsed;

  const onMainMenuClick = useCallback(() => {
    if (isMobileNav) {
      setMobileNavOpen(true);
      return;
    }
    setDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      setCookie(
        COOKIE_SIDEBAR_COLLAPSED,
        next ? "1" : "0",
        COOKIE_TEN_YEARS
      );
      return next;
    });
  }, [isMobileNav]);

  const shellClass = [
    "app-shell",
    isMobileNav && mobileNavOpen ? "mobile-nav-open" : "",
    desktopSidebarHidden ? "sidebar-collapsed-desktop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label={t.closeMenu}
        aria-hidden={!(isMobileNav && mobileNavOpen)}
        tabIndex={isMobileNav && mobileNavOpen ? undefined : -1}
        onClick={closeMobileNav}
      />
      <Sidebar
        boot={boot}
        hasApiKey={hasApiKey}
        fromUrlKey={fromUrlKey}
        backend={backend}
        onBackendChange={onBackendChange}
        onNewChat={onNewChat}
        busy={busy}
        sessions={sessions}
        activeConversationId={activeConversationId}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        isMobileDrawer={isMobileNav}
        onCloseDrawer={closeMobileNav}
        onAfterDrawerNavigate={afterMobileDrawerNav}
        inertDesktop={desktopSidebarHidden}
      />
      <main className="main-panel">
        <header className="main-mobile-header">
          <button
            type="button"
            className="main-menu-btn"
            aria-label={
              isMobileNav
                ? t.openMenu
                : desktopSidebarCollapsed
                  ? t.expandSidebar
                  : t.collapseSidebar
            }
            aria-expanded={
              isMobileNav ? mobileNavOpen : !desktopSidebarCollapsed
            }
            aria-controls="relay-sidebar"
            onClick={onMainMenuClick}
          >
            <svg
              className="main-menu-icon"
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            className="main-header-new-chat"
            aria-label={t.newChat}
            disabled={!hasApiKey || busy}
            onClick={() => void onNewChat()}
          >
            <svg
              className="main-header-new-chat-icon"
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </header>
        {showLocalNotice ? (
          <div className="main-local-notice" role="note">
            <span className="main-local-notice-icon" aria-hidden>
              ●
            </span>
            <p className="main-local-notice-text">
              <strong>{t.localNoticeStrong}</strong> {t.localNoticeBody}
            </p>
            <button
              type="button"
              className="main-local-notice-dismiss"
              aria-label={t.closeNotice}
              onClick={() => {
                setCookie(COOKIE_LOCAL_NOTICE_DISMISSED, "1", COOKIE_TEN_YEARS);
                setShowLocalNotice(false);
              }}
            >
              ×
            </button>
          </div>
        ) : null}
        <MessageList
          messages={messages}
          logoUrl={boot.logoUrl}
          hasApiKey={hasApiKey}
        />
        {error ? (
          <div className="main-error" role="alert" aria-live="polite">
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
            hasApiKey ? t.placeholderHasKey : t.placeholderNoKey
          }
        />
      </main>
    </div>
  );
}
