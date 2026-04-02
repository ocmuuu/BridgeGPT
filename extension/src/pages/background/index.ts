import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import {
  API_KEY_STORAGE_KEY,
  EXTENSION_UPDATE_AVAILABLE_KEY,
  generateBridgegptApiKey,
  LEGACY_ROOM_ID_STORAGE_KEY,
  RELAY_PAUSED_BY_USER_KEY,
  relayBaseFromStoredString,
  RELAY_SERVER_STORAGE_KEY,
} from "@src/config";
import { compareSemver } from "@src/lib/semverCompare";
import {
  normalizeWebProviderId,
  tabUrlMatchesProvider,
  WEB_PROVIDERS,
  type WebProviderId,
} from "@src/webProviders/config";

/**
 * Broadcast to extension pages (popup/settings). When none are open, Chrome sets
 * lastError — must use a callback or you get uncaught promise rejections in the SW.
 */
function safeRuntimeSendMessage(message: object): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}

/** True when no content script / tab receiver (not e.g. "port closed" from missing sendResponse). */
function isTabsMessageNoReceiver(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection")
  );
}

const KEEP_ALIVE_ALARM = "bridgegpt-keep-alive";
/** 30s interval expressed in minutes for chrome.alarms (fractional minutes allowed). */
const KEEP_ALIVE_DELAY_MINUTES = 30 / 60;

const EXTENSION_VERSION_CHECK_ALARM = "bridgegpt-extension-version-check";
/** Daily check against relay `GET /version`. */
const EXTENSION_VERSION_CHECK_PERIOD_MINUTES = 24 * 60;

function scheduleExtensionVersionCheckAlarm(): void {
  chrome.alarms.create(EXTENSION_VERSION_CHECK_ALARM, {
    delayInMinutes: EXTENSION_VERSION_CHECK_PERIOD_MINUTES,
    periodInMinutes: EXTENSION_VERSION_CHECK_PERIOD_MINUTES,
  });
}

/** Toolbar action badge: "!" when relay reports a newer extension than this install. */
async function syncExtensionUpdateBadge(): Promise<void> {
  const { [EXTENSION_UPDATE_AVAILABLE_KEY]: v } =
    await chrome.storage.local.get(EXTENSION_UPDATE_AVAILABLE_KEY);
  const has = typeof v === "string" && v.length > 0;
  await chrome.action.setBadgeBackgroundColor({ color: "#D97706" });
  await chrome.action.setBadgeText({ text: has ? "!" : "" });
  await chrome.action.setTitle({
    title: has
      ? "BridgeGPT — update available (open popup → Settings)"
      : "BridgeGPT",
  });
}

type ExtensionVersionCheckResult =
  | {
      ok: true;
      local: string;
      server: string;
      status: "unchanged" | "update_available";
    }
  | { ok: false; error: string };

async function runExtensionVersionCheck(): Promise<ExtensionVersionCheckResult> {
  try {
    const base = await getEffectiveRelayBaseUrl();
    const origin = String(base).replace(/\/+$/, "");
    const res = await fetch(`${origin}/version`, { credentials: "omit" });
    if (!res.ok) {
      return { ok: false, error: `Relay returned HTTP ${res.status}` };
    }
    const data = (await res.json()) as { extension?: unknown };
    const serverExt =
      typeof data.extension === "string" ? data.extension.trim() : "";
    if (!serverExt) {
      return { ok: false, error: "Relay /version response missing extension" };
    }

    const local =
      typeof chrome.runtime.getManifest().version === "string"
        ? chrome.runtime.getManifest().version
        : "0.0.0";

    if (compareSemver(serverExt, local) <= 0) {
      await chrome.storage.local.remove([
        EXTENSION_UPDATE_AVAILABLE_KEY,
        "lastExtensionUpdateNotifiedVersion",
      ]);
      await syncExtensionUpdateBadge();
      return { ok: true, local, server: serverExt, status: "unchanged" };
    }

    await chrome.storage.local.set({
      [EXTENSION_UPDATE_AVAILABLE_KEY]: serverExt,
    });
    await syncExtensionUpdateBadge();
    return { ok: true, local, server: serverExt, status: "update_available" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkExtensionVersionAgainstRelay(): Promise<void> {
  await runExtensionVersionCheck();
}

let socketConnectionStatus: {
  status: "pending" | "connected" | "failed" | "disconnected";
  errorMessage?: string;
} = {
  status: "disconnected",
  errorMessage: undefined,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: "src/pages/settings/index.html" });
  syncKeepAliveFromStorage();
  scheduleExtensionVersionCheckAlarm();
  void checkExtensionVersionAgainstRelay();
});

chrome.runtime.onStartup.addListener(() => {
  syncKeepAliveFromStorage();
  scheduleExtensionVersionCheckAlarm();
});

function readApiKeyFromSettings(settings: {
  [key: string]: unknown;
}): string | null {
  const primary = settings[API_KEY_STORAGE_KEY];
  if (typeof primary === "string" && primary.length > 0) return primary;
  const legacy = settings[LEGACY_ROOM_ID_STORAGE_KEY];
  if (typeof legacy === "string" && legacy.length > 0) return legacy;
  return null;
}

function migrateLegacyApiKeyIfNeeded(
  settings: { [key: string]: unknown },
  apiKey: string
): void {
  const hasPrimary =
    typeof settings[API_KEY_STORAGE_KEY] === "string" &&
    (settings[API_KEY_STORAGE_KEY] as string).length > 0;
  if (hasPrimary) return;
  if (
    typeof settings[LEGACY_ROOM_ID_STORAGE_KEY] === "string" &&
    (settings[LEGACY_ROOM_ID_STORAGE_KEY] as string).length > 0
  ) {
    chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: apiKey }, () => {
      chrome.storage.local.remove(LEGACY_ROOM_ID_STORAGE_KEY);
    });
  }
}

const getStoredApiKey = (): Promise<string> => {
  return new Promise((res) => {
    chrome.storage.local.get(
      [API_KEY_STORAGE_KEY, LEGACY_ROOM_ID_STORAGE_KEY],
      (settings) => {
        if (chrome.runtime.lastError) {
          const fresh = generateBridgegptApiKey();
          chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: fresh }, () =>
            res(fresh)
          );
          return;
        }
        const existing = readApiKeyFromSettings(settings);
        if (existing !== null) {
          migrateLegacyApiKeyIfNeeded(settings, existing);
          res(existing);
          return;
        }
        const fresh = generateBridgegptApiKey();
        chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: fresh }, () =>
          res(fresh)
        );
      }
    );
  });
};

async function getEffectiveRelayBaseUrl(): Promise<string> {
  const { [RELAY_SERVER_STORAGE_KEY]: raw } = await chrome.storage.local.get(
    RELAY_SERVER_STORAGE_KEY
  );
  return relayBaseFromStoredString(raw as string | undefined);
}

/**
 * New api_key. If the relay WebSocket was connected, reconnect so the server
 * only registers the new session id (same string as OpenAI api_key).
 */
async function rotateStoredApiKey(): Promise<string> {
  const newKey = generateBridgegptApiKey();
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: newKey }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(LEGACY_ROOM_ID_STORAGE_KEY, () => resolve());
  });
  const wasConnected = socket?.connected === true;
  if (wasConnected) {
    disconnectWS();
    await new Promise<void>((r) =>
      chrome.storage.local.remove(RELAY_PAUSED_BY_USER_KEY, () => r())
    );
    await connectWS();
  }
  return newKey;
}

async function openAiV1BaseUrl(): Promise<string> {
  const base = (await getEffectiveRelayBaseUrl()).replace(/\/+$/, "");
  return `${base}/v1`;
}

type OpenAIClientConfig = {
  v1BaseUrl: string;
  apiKey: string;
};

const getOpenAIClientConfig = async (): Promise<OpenAIClientConfig> => {
  const apiKey = await getStoredApiKey();
  return { v1BaseUrl: await openAiV1BaseUrl(), apiKey };
};

/** Cold-tab delay before ask_question: Grok’s SPA + Tiptap need longer than ChatGPT. */
const COLD_TAB_DELIVER_MS: Partial<Record<WebProviderId, number>> = {
  grok: 7000,
};

/** Last-used tab per provider (memory + session storage). */
const tabIdByProvider: Partial<Record<WebProviderId, number>> = {};
let socket: Socket | undefined;

async function rememberProviderTab(
  provider: WebProviderId,
  id: number
): Promise<void> {
  tabIdByProvider[provider] = id;
  const key = WEB_PROVIDERS[provider].sessionTabKey;
  await chrome.storage.session.set({ [key]: id });
}

/** Reuse in-memory tab id, session storage, or any matching tab for this provider. */
async function resolveProviderTabId(
  provider: WebProviderId
): Promise<number | undefined> {
  const cfg = WEB_PROVIDERS[provider];

  const mem = tabIdByProvider[provider];
  if (typeof mem === "number") {
    const t = await chrome.tabs.get(mem).catch(() => null);
    if (tabUrlMatchesProvider(t?.url, provider)) return mem;
  }

  const session = await chrome.storage.session.get(cfg.sessionTabKey);
  const stored = session[cfg.sessionTabKey] as number | undefined;
  if (typeof stored === "number") {
    const t = await chrome.tabs.get(stored).catch(() => null);
    if (tabUrlMatchesProvider(t?.url, provider)) {
      tabIdByProvider[provider] = stored;
      return stored;
    }
  }

  for (const pattern of cfg.tabsQueryPatterns) {
    const tabs = await chrome.tabs.query({ url: pattern });
    const first = tabs.find((x) => x.id !== undefined);
    if (first?.id !== undefined) {
      await rememberProviderTab(provider, first.id);
      return first.id;
    }
  }

  return undefined;
}

function scheduleKeepAliveAlarm(): void {
  chrome.alarms.create(KEEP_ALIVE_ALARM, {
    delayInMinutes: KEEP_ALIVE_DELAY_MINUTES,
  });
}

async function maybeReconnectKeepLong(): Promise<void> {
  const { keepLongConnection, [RELAY_PAUSED_BY_USER_KEY]: pausedByUser } =
    await chrome.storage.local.get([
      "keepLongConnection",
      RELAY_PAUSED_BY_USER_KEY,
    ]);
  if (keepLongConnection !== true) return;
  if (pausedByUser === true) return;
  if (socket?.connected) return;
  if (socketConnectionStatus.status === "pending") return;
  void connectWS();
}

/** Read "keep alive" and start/stop the periodic alarm (alarms can wake an idle MV3 service worker). */
function syncKeepAliveFromStorage(): void {
  chrome.storage.local.get("keepLongConnection", (r) => {
    if (chrome.runtime.lastError) return;
    if (r.keepLongConnection === true) {
      chrome.alarms.clear(KEEP_ALIVE_ALARM, () => {
        void maybeReconnectKeepLong();
        scheduleKeepAliveAlarm();
      });
    } else {
      chrome.alarms.clear(KEEP_ALIVE_ALARM);
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if ("keepLongConnection" in changes) {
    syncKeepAliveFromStorage();
  }
  if (RELAY_SERVER_STORAGE_KEY in changes) {
    const wasConnected = socket?.connected === true;
    disconnectWS();
    void checkExtensionVersionAgainstRelay();
    void (async () => {
      const { keepLongConnection } = await chrome.storage.local.get(
        "keepLongConnection"
      );
      if (keepLongConnection === true && wasConnected) {
        await new Promise<void>((r) =>
          chrome.storage.local.remove(RELAY_PAUSED_BY_USER_KEY, () => r())
        );
        await connectWS();
      }
    })();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === EXTENSION_VERSION_CHECK_ALARM) {
    void checkExtensionVersionAgainstRelay();
    return;
  }
  if (alarm.name !== KEEP_ALIVE_ALARM) return;
  void (async () => {
    await maybeReconnectKeepLong();
    const { keepLongConnection } = await chrome.storage.local.get(
      "keepLongConnection"
    );
    if (keepLongConnection === true) {
      scheduleKeepAliveAlarm();
    }
  })();
});

syncKeepAliveFromStorage();
scheduleExtensionVersionCheckAlarm();
void syncExtensionUpdateBadge();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(EXTENSION_UPDATE_AVAILABLE_KEY in changes)) return;
  void syncExtensionUpdateBadge();
});

async function connectWS() {
  try {
    if (socket?.connected) return;
    if (socketConnectionStatus.status === "pending") return;

    socket?.disconnect();
    socket = undefined;

    const baseUrl = await getEffectiveRelayBaseUrl();

    socketConnectionStatus.errorMessage = "";
    socketConnectionStatus.status = "pending";
    safeRuntimeSendMessage({
      type: "get_connection_status",
      content: socketConnectionStatus,
    });
    socket = io(baseUrl, {
      transports: ["websocket"], // IMPORTANT for stability
      reconnection: true,
      reconnectionAttempts: 3,
    });

    socket.on("connect", async () => {
      const sock = socket;
      if (!sock) return;
      const apiKey = await getStoredApiKey();
      const origin = String(baseUrl).replace(/\/+$/, "");
      const socketId = sock.id;
      if (!socketId) {
        console.error("[BridgeGPT] socket.id missing after connect");
        return;
      }
      const registerUrl = `${origin}/connect/${encodeURIComponent(apiKey)}?socketId=${encodeURIComponent(socketId)}`;
      try {
        const res = await fetch(registerUrl);
        const text = await res.text();
        if (!res.ok) {
          console.error(
            "[BridgeGPT] Relay GET /connect failed:",
            res.status,
            text.slice(0, 400)
          );
          socketConnectionStatus.status = "disconnected";
          socketConnectionStatus.errorMessage =
            res.status === 404
              ? "Relay could not attach this socket (404). Click Connect again."
              : `Relay registration failed (${res.status}): ${text.slice(0, 160)}`;
          safeRuntimeSendMessage({
            type: "get_connection_status",
            content: socketConnectionStatus,
          });
          sock.disconnect();
          return;
        }
        socketConnectionStatus.status = "connected";
        socketConnectionStatus.errorMessage = "";
        safeRuntimeSendMessage({
          type: "get_connection_status",
          content: socketConnectionStatus,
        });
        console.log(
          "[BridgeGPT] Relay room registered; api_key prefix:",
          apiKey.slice(0, 20)
        );
        void checkExtensionVersionAgainstRelay();
      } catch (e) {
        console.error("[BridgeGPT] Relay /connect fetch error:", e);
        socketConnectionStatus.status = "disconnected";
        socketConnectionStatus.errorMessage =
          e instanceof Error ? e.message : String(e);
        safeRuntimeSendMessage({
          type: "get_connection_status",
          content: socketConnectionStatus,
        });
        sock.disconnect();
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[BG] Disconnected", reason);
      if (reason === "io client disconnect") {
        return;
      }
      socketConnectionStatus.status = "disconnected";
      socketConnectionStatus.errorMessage = String(reason);
      safeRuntimeSendMessage({
        type: "get_connection_status",
        content: socketConnectionStatus,
      });
    });

    socket.on("connect_error", (err) => handleErrorOnConnect(err));
    socket.on("connect_failed", (err) => handleErrorOnConnect(err));

    socket.on("serverMessage", async (msg) => {
      const route =
        msg && typeof msg === "object" && "route" in msg
          ? String((msg as { route?: unknown }).route)
          : "?";
      const provider = normalizeWebProviderId(
        msg && typeof msg === "object" && "provider" in msg
          ? (msg as { provider?: unknown }).provider
          : "chatgpt"
      );
      const pcfg = WEB_PROVIDERS[provider];
      console.log(
        "[BridgeGPT] serverMessage route=",
        route,
        "provider=",
        pcfg.id
      );

      const deliver = (targetTabId: number, attempt: "primary" | "retry") => {
        chrome.tabs.sendMessage(
          targetTabId,
          { type: "ask_question", content: msg },
          () => {
            const err = chrome.runtime.lastError;
            if (err) {
              console.warn(
                "[BridgeGPT] tabs.sendMessage:",
                err.message,
                "tabId=",
                targetTabId,
                "attempt=",
                attempt
              );
              if (
                attempt === "primary" &&
                isTabsMessageNoReceiver(err.message)
              ) {
                console.log(
                  `[BridgeGPT] Opening ${pcfg.label} tab and retrying…`
                );
                chrome.tabs.create(
                  { url: pcfg.startUrl, active: true },
                  (tab) => {
                    const id = tab?.id;
                    if (id === undefined) return;
                    void rememberProviderTab(provider, id);
                    const ms = COLD_TAB_DELIVER_MS[provider] ?? 3500;
                    setTimeout(() => deliver(id, "retry"), ms);
                  }
                );
              }
              return;
            }
            console.log(
              "[BridgeGPT] ask_question delivered tabId=",
              targetTabId,
              "attempt=",
              attempt
            );
          }
        );
      };

      const targetTabId = await resolveProviderTabId(provider);
      if (targetTabId === undefined) {
        console.log(`[BridgeGPT] No ${pcfg.label} tab; creating tab`);
        chrome.tabs.create({ url: pcfg.startUrl, active: true }, (tab) => {
          const id = tab?.id;
          if (id === undefined) return;
          void rememberProviderTab(provider, id);
          const ms = COLD_TAB_DELIVER_MS[provider] ?? 3500;
          setTimeout(() => deliver(id, "retry"), ms);
        });
      } else {
        deliver(targetTabId, "primary");
      }
    });
  } catch (e: any) {
    console.log("Catch error ", e);
    handleErrorOnConnect(e);
  }
}

const disconnectWS = () => {
  const s = socket;
  socket = undefined;
  s?.disconnect();
  socketConnectionStatus.status = "disconnected";
  socketConnectionStatus.errorMessage = undefined;
  safeRuntimeSendMessage({
    type: "get_connection_status",
    content: socketConnectionStatus,
  });
};

const handleErrorOnConnect = (err: any) => {
  console.log("handleErrorOnConnect ", err);
  socketConnectionStatus.status = "disconnected";
  socketConnectionStatus.errorMessage = err.message;
  safeRuntimeSendMessage({
    type: "get_connection_status",
    content: socketConnectionStatus,
  });
};

/** Payload sent to relay over Socket.IO; includes page-script capture, relayRequest, extensionMeta. */
export type ClientRelayPayload = Record<string, unknown>;

type AgentMessage =
  | { type: "question_answer"; content: ClientRelayPayload | string }
  | { type: "get_connect_url" }
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "get_connection_status" }
  | { type: "reset_api_key" }
  | { type: "check_extension_version" };

chrome.runtime.onMessage.addListener(
  async (msg: AgentMessage, _sender, sendResponse) => {
    console.log("msgmsgmsg ", msg);
    if (msg.type === "question_answer") {
      const apiKey = await getStoredApiKey();
      socket?.emit("clientResponse", {
        roomId: apiKey,
        message: msg.content as ClientRelayPayload | string,
      });
    } else if (msg.type === "get_connect_url") {
      const cfg = await getOpenAIClientConfig();
      safeRuntimeSendMessage({ type: "set_openai_config", content: cfg });
    } else if (msg.type === "connect") {
      await new Promise<void>((r) =>
        chrome.storage.local.remove(RELAY_PAUSED_BY_USER_KEY, () => r())
      );
      void connectWS();
    } else if (msg.type === "disconnect") {
      disconnectWS();
      chrome.storage.local.set({ [RELAY_PAUSED_BY_USER_KEY]: true });
    } else if (msg.type === "get_connection_status") {
      safeRuntimeSendMessage({
        type: "get_connection_status",
        content: socketConnectionStatus,
      });
    } else if (msg.type === "reset_api_key") {
      try {
        await rotateStoredApiKey();
        const cfg = await getOpenAIClientConfig();
        safeRuntimeSendMessage({ type: "set_openai_config", content: cfg });
        sendResponse({ ok: true as const, apiKey: cfg.apiKey });
      } catch (e) {
        sendResponse({
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } else if (msg.type === "check_extension_version") {
      const result = await runExtensionVersionCheck();
      sendResponse(result);
    }
    return true; // Keep async messaging alive
  }
);
