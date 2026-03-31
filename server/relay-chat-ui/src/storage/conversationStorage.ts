/**
 * Persists relay chat sessions for the web origin (`localStorage`).
 * When `globalThis.chrome.storage` exists (extension context), uses that instead.
 */
/** Optional per-assistant-turn source (backend + model). */
export type StoredTurn = {
  role: "user" | "assistant";
  content: string;
  backend?: "openai" | "gemini";
  model?: string;
};

/** Max chars from first user message for list title. */
export const CONVERSATION_TITLE_MAX_CHARS = 48;

export type StoredConversation = {
  id: string;
  /** Title derived from first user message (truncated). */
  title: string;
  createdAt: number;
  updatedAt: number;
  backend: "openai" | "gemini";
  model: string;
  turns: StoredTurn[];
};

export type RelayChatPersistedState = {
  sessions: StoredConversation[];
  activeConversationId: string | null;
};

const LS_V2 = "bridgegpt_relay_chat_state_v2";
const LS_V1 = "bridgegpt_relay_chat_history_v1";

type Chromeish = {
  storage?: {
    local?: {
      get(keys: string[], cb: (r: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, cb?: () => void): void;
      remove?(keys: string[], cb?: () => void): void;
    };
  };
  runtime?: { lastError?: { message: string } };
};

function chromeApi(): Chromeish | undefined {
  return (globalThis as unknown as { chrome?: Chromeish }).chrome;
}

function hasChromeStorage(): boolean {
  const c = chromeApi();
  return !!(c?.storage?.local?.get && c?.storage?.local?.set);
}

function isStoredTurn(v: unknown): v is StoredTurn {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (
    (o.role !== "user" && o.role !== "assistant") ||
    typeof o.content !== "string"
  ) {
    return false;
  }
  if (
    o.backend !== undefined &&
    o.backend !== "openai" &&
    o.backend !== "gemini"
  ) {
    return false;
  }
  if (o.model !== undefined && typeof o.model !== "string") return false;
  return true;
}

function parseV2(raw: unknown): RelayChatPersistedState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.sessions)) return null;
  const sessions: StoredConversation[] = [];
  for (const s of o.sessions) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    if (r.backend !== "openai" && r.backend !== "gemini") continue;
    if (typeof r.model !== "string") continue;
    if (typeof r.title !== "string") continue;
    if (typeof r.createdAt !== "number" || typeof r.updatedAt !== "number")
      continue;
    if (!Array.isArray(r.turns) || !r.turns.every(isStoredTurn)) continue;
    sessions.push({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      backend: r.backend,
      model: r.model,
      turns: r.turns,
    });
  }
  const active =
    o.activeConversationId === null
      ? null
      : typeof o.activeConversationId === "string"
        ? o.activeConversationId
        : null;
  return { sessions, activeConversationId: active };
}

function normalizeState(state: RelayChatPersistedState): RelayChatPersistedState {
  const ids = new Set(state.sessions.map((s) => s.id));
  let active = state.activeConversationId;
  /** Keep active id when it is not yet in sessions (new empty thread). */
  if (active && !ids.has(active)) {
    return { sessions: state.sessions, activeConversationId: active };
  }
  if (!active && state.sessions.length) {
    const pick = [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0]!;
    active = pick.id;
  }
  return { sessions: state.sessions, activeConversationId: active };
}

export function deriveConversationTitle(
  turns: StoredTurn[],
  maxLen = CONVERSATION_TITLE_MAX_CHARS
): string {
  const first = turns.find((t) => t.role === "user" && t.content.trim());
  if (!first) return "New chat";
  const oneLine = first.content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}…`;
}

/** Model used for the first message in history (first turn with a non-empty model). */
export function deriveListModelFromTurns(turns: StoredTurn[]): string {
  for (const t of turns) {
    if (typeof t.model === "string" && t.model.trim()) return t.model.trim();
  }
  return "";
}

/** Sidebar / session row: show starter model, not the latest composer selection. */
export function sessionListModelLabel(s: StoredConversation): string {
  return deriveListModelFromTurns(s.turns) || s.model || s.backend;
}

/** True when role/content and per-turn backend+model match (order-sensitive). */
export function turnsContentEqual(a: StoredTurn[], b: StoredTurn[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.role !== y.role || x.content !== y.content) return false;
    if (x.backend !== y.backend) return false;
    if ((x.model ?? "") !== (y.model ?? "")) return false;
  }
  return true;
}

export function buildOrUpdateSession(
  existing: StoredConversation | undefined,
  opts: {
    id: string;
    turns: StoredTurn[];
    backend: "openai" | "gemini";
    model: string;
  }
): StoredConversation {
  const now = Date.now();
  const title = deriveConversationTitle(opts.turns);
  if (!existing) {
    return {
      id: opts.id,
      title,
      createdAt: now,
      updatedAt: now,
      backend: opts.backend,
      model: opts.model,
      turns: opts.turns,
    };
  }
  const sameTurns = turnsContentEqual(existing.turns, opts.turns);
  return {
    ...existing,
    title,
    /** Only bump when the conversation actually changed (new/edit message), not on tab switch re-save. */
    updatedAt: sameTurns ? existing.updatedAt : now,
    backend: opts.backend,
    model: opts.model,
    turns: opts.turns,
  };
}

async function storageGetV2(): Promise<unknown | null> {
  const c = chromeApi();
  if (hasChromeStorage() && c?.storage?.local) {
    return new Promise((resolve) => {
      c.storage!.local!.get([LS_V2, LS_V1], (r) => {
        if (r[LS_V2] != null) resolve(r[LS_V2]);
        else resolve(r[LS_V1] ?? null);
      });
    });
  }
  try {
    const v2 = localStorage.getItem(LS_V2);
    if (v2) return JSON.parse(v2) as unknown;
    const v1 = localStorage.getItem(LS_V1);
    if (v1) return JSON.parse(v1) as unknown;
    return null;
  } catch {
    return null;
  }
}

function migrateV1Turns(turns: StoredTurn[]): RelayChatPersistedState | null {
  if (!turns.length) return null;
  const now = Date.now();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `mig-${now}`;
  return {
    sessions: [
      {
        id,
        title: deriveConversationTitle(turns),
        createdAt: now,
        updatedAt: now,
        backend: "openai",
        model: "",
        turns,
      },
    ],
    activeConversationId: id,
  };
}

async function storageSetV2(state: RelayChatPersistedState): Promise<void> {
  const payload = { version: 2, ...state };
  const c = chromeApi();
  if (hasChromeStorage() && c?.storage?.local) {
    return new Promise((resolve, reject) => {
      c.storage!.local!.set({ [LS_V2]: payload }, () => {
        const err = c.runtime?.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        if (c.storage!.local!.remove) {
          c.storage!.local!.remove([LS_V1], () => {
            const err2 = c.runtime?.lastError;
            if (err2) reject(new Error(err2.message));
            else resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }
  try {
    localStorage.setItem(LS_V2, JSON.stringify(payload));
    localStorage.removeItem(LS_V1);
  } catch {
    /* quota / private mode */
  }
}

async function storageRemoveV1(): Promise<void> {
  const c = chromeApi();
  const remove = c?.storage?.local?.remove;
  if (hasChromeStorage() && remove) {
    return new Promise((resolve, reject) => {
      remove([LS_V1], () => {
        const err = c.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      });
    });
  }
  try {
    localStorage.removeItem(LS_V1);
  } catch {
    /* ignore */
  }
}

export async function loadRelayChatState(): Promise<RelayChatPersistedState | null> {
  const raw = await storageGetV2();
  let parsed = parseV2(raw);

  if (!parsed && raw != null) {
    if (Array.isArray(raw) && raw.every(isStoredTurn)) {
      const migrated = migrateV1Turns(raw as StoredTurn[]);
      if (migrated) {
        await storageSetV2(migrated);
        await storageRemoveV1();
        parsed = migrated;
      }
    }
  }

  if (!parsed) return null;
  return normalizeState(parsed);
}

export async function saveRelayChatState(
  state: RelayChatPersistedState
): Promise<void> {
  await storageSetV2(normalizeState(state));
}

export async function deleteSession(
  state: RelayChatPersistedState,
  sessionId: string
): Promise<RelayChatPersistedState> {
  const sessions = state.sessions.filter((s) => s.id !== sessionId);
  let active = state.activeConversationId;
  if (active === sessionId) {
    active = sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
  }
  const next = normalizeState({ sessions, activeConversationId: active });
  await saveRelayChatState(next);
  return next;
}
