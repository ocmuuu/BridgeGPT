import { useMemo } from "react";

import { useI18n } from "../i18n/I18nProvider.js";
import { RelaySetupHint } from "./RelaySetupHint.js";
import type { StoredConversation } from "../storage/conversationStorage";
import type { RelayChatBoot } from "../types/boot";

type Props = {
  boot: RelayChatBoot;
  hasApiKey: boolean;
  fromUrlKey: boolean;
  backend: "openai" | "gemini";
  onBackendChange: (b: "openai" | "gemini") => void;
  onNewChat: () => void | Promise<void>;
  busy: boolean;
  sessions: StoredConversation[];
  activeConversationId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void | Promise<void>;
  /** Narrow viewport: sidebar is an overlay drawer */
  isMobileDrawer?: boolean;
  onCloseDrawer?: () => void;
  /** Close drawer after switching chat (ChatGPT-like) */
  onAfterDrawerNavigate?: () => void;
  /** Desktop: sidebar visually hidden — remove from a11y tree */
  inertDesktop?: boolean;
};

export function Sidebar({
  boot,
  hasApiKey,
  fromUrlKey,
  backend,
  onBackendChange,
  onNewChat,
  busy,
  sessions,
  activeConversationId,
  onSelectSession,
  onDeleteSession,
  isMobileDrawer = false,
  onCloseDrawer,
  onAfterDrawerNavigate,
  inertDesktop = false,
}: Props) {
  const { t, intlLocale, toggleLocale, langToggleLabel, langToggleAriaLabel } =
    useI18n();

  const sessionTimeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [intlLocale]
  );

  function formatSessionWhen(ts: number): string {
    try {
      return sessionTimeFmt.format(new Date(ts));
    } catch {
      return "";
    }
  }

  const orderedSessions = [...sessions].sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  return (
    <aside
      className="sidebar"
      id="relay-sidebar"
      aria-hidden={inertDesktop ? true : undefined}
      inert={inertDesktop ? true : undefined}
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-head">
          <div
            className="sidebar-brand-row"
            aria-label={isMobileDrawer ? "BridgeGPT" : undefined}
          >
            <img
              className="sidebar-logo-img"
              src={boot.logoUrl}
              alt=""
              width={36}
              height={36}
              decoding="async"
            />
            <div className="sidebar-brand-text">
              <div className="sidebar-tag">{t.sidebarTag}</div>
              <div className="sidebar-logo">BridgeGPT</div>
            </div>
          </div>
          <div className="sidebar-brand-actions">
            <button
              type="button"
              className="sidebar-lang-toggle"
              aria-label={langToggleAriaLabel}
              onClick={toggleLocale}
            >
              {langToggleLabel}
            </button>
            {isMobileDrawer ? (
              <button
                type="button"
                className="sidebar-mobile-close"
                aria-label={t.closeMenu}
                onClick={onCloseDrawer}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="sidebar-new-chat"
        disabled={!hasApiKey || busy}
        onClick={() => {
          void onNewChat();
          onAfterDrawerNavigate?.();
        }}
      >
        {t.newChat}
      </button>

      {hasApiKey && (
        <div className="sidebar-section">
          <div className="sidebar-label">{t.connection}</div>
          <p className="sidebar-status ok">
            {fromUrlKey ? t.connectionFromUrl : t.connectionFromCookie}
          </p>
        </div>
      )}

      <div className="sidebar-section">
        <label className="sidebar-label" htmlFor="sidebar-backend">
          {t.backend}
        </label>
        <select
          id="sidebar-backend"
          className="sidebar-select"
          value={backend}
          disabled={!hasApiKey || busy}
          onChange={(e) =>
            onBackendChange(e.target.value as "openai" | "gemini")
          }
        >
          <option value="openai">{t.backendOpenAI}</option>
          <option value="gemini">{t.backendGemini}</option>
        </select>
      </div>

      {hasApiKey && orderedSessions.length > 0 ? (
        <>
          <div className="sidebar-divider" role="separator" aria-hidden />
          <div className="sidebar-history">
            <div className="sidebar-label">{t.history}</div>
            <ul className="sidebar-history-list" role="list">
              {orderedSessions.map((s) => {
                const active = s.id === activeConversationId;
                return (
                  <li key={s.id} className="sidebar-history-item">
                    <button
                      type="button"
                      className={
                        active
                          ? "sidebar-history-row sidebar-history-row-active"
                          : "sidebar-history-row"
                      }
                      disabled={busy}
                      onClick={() => {
                        onSelectSession(s.id);
                        onAfterDrawerNavigate?.();
                      }}
                    >
                      <span className="sidebar-history-title">{s.title}</span>
                      <span className="sidebar-history-meta">
                        {formatSessionWhen(s.updatedAt)} ·{" "}
                        {s.model || s.backend}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-history-delete"
                      title={t.deleteSession}
                      disabled={busy}
                      aria-label={t.deleteSessionAria(s.title)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteSession(s.id);
                      }}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}

      {!hasApiKey ? <RelaySetupHint /> : null}
    </aside>
  );
}
