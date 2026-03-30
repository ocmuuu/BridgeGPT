import type { StoredConversation } from "../storage/conversationStorage";
import type { RelayChatBoot } from "../types/boot";

const sessionTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatSessionWhen(ts: number): string {
  try {
    return sessionTimeFmt.format(new Date(ts));
  } catch {
    return "";
  }
}

type Props = {
  boot: RelayChatBoot;
  hasApiKey: boolean;
  fromUrlKey: boolean;
  backend: "openai" | "gemini";
  onBackendChange: (b: "openai" | "gemini") => void;
  model: string;
  onModelChange: (m: string) => void;
  onNewChat: () => void | Promise<void>;
  busy: boolean;
  sessions: StoredConversation[];
  activeConversationId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void | Promise<void>;
};

export function Sidebar({
  boot,
  hasApiKey,
  fromUrlKey,
  backend,
  onBackendChange,
  model,
  onModelChange,
  onNewChat,
  busy,
  sessions,
  activeConversationId,
  onSelectSession,
  onDeleteSession,
}: Props) {
  const models =
    backend === "openai" ? boot.openaiModels : boot.geminiModels;

  const orderedSessions = [...sessions].sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar-new-chat"
        disabled={!hasApiKey || busy}
        onClick={() => void onNewChat()}
      >
        + New chat
      </button>

      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <img
            className="sidebar-logo-img"
            src={boot.logoUrl}
            alt=""
            width={36}
            height={36}
            decoding="async"
          />
          <div className="sidebar-brand-text">
            <div className="sidebar-tag">Web relay</div>
            <div className="sidebar-logo">BridgeGPT</div>
          </div>
        </div>
      </div>

      {hasApiKey && (
        <div className="sidebar-section">
          <div className="sidebar-label">Connection</div>
          <p className="sidebar-status ok">
            {fromUrlKey
              ? "api_key saved from URL to cookie."
              : "Using saved api_key cookie."}
          </p>
        </div>
      )}

      <div className="sidebar-section">
        <label className="sidebar-label" htmlFor="sidebar-backend">
          Backend
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
          <option value="openai">ChatGPT · OpenAI API</option>
          <option value="gemini">Gemini · Google API</option>
        </select>
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label" htmlFor="sidebar-model">
          Model
        </label>
        <select
          id="sidebar-model"
          className="sidebar-select"
          value={model}
          disabled={!hasApiKey || busy}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      {hasApiKey && orderedSessions.length > 0 ? (
        <>
          <div className="sidebar-divider" role="separator" aria-hidden />
          <div className="sidebar-history">
            <div className="sidebar-label">History</div>
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
                      onClick={() => onSelectSession(s.id)}
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
                      title="Delete"
                      disabled={busy}
                      aria-label={`Delete ${s.title}`}
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

      {!hasApiKey && (
        <div className="sidebar-setup">
          <p className="sidebar-setup-title">Set up</p>
          <p>
            Open this page from the <strong>BridgeGPT</strong> extension:
            Settings → <strong>Open web chat</strong> (cookie stores{" "}
            <code>api_key</code> for this origin).
          </p>
          <p>
            Or visit once with{" "}
            <code>?api_key=&lt;room id&gt;</code> — it will be saved and
            stripped from the URL.
          </p>
        </div>
      )}
    </aside>
  );
}
