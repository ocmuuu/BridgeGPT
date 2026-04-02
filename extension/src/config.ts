/** chrome.storage.local: relay advertises a newer extension; value is semver string. */
export const EXTENSION_UPDATE_AVAILABLE_KEY = "extensionUpdateAvailable";

export const BRIDGEGPT_GITHUB_RELEASES_URL =
  "https://github.com/ocmuuu/BridgeGPT/releases";

/** chrome.storage.local: user override; unset means use {@link DEFAULT_RELAY_BASE_URL}. */
export const RELAY_SERVER_STORAGE_KEY = "relayServerBaseUrl";

/**
 * When true, keep-alive must not auto-reconnect (user chose Disconnect).
 * Cleared on explicit Connect, relay reconnect after URL change, or api_key rotate.
 */
export const RELAY_PAUSED_BY_USER_KEY = "relayPausedByUser";

/** chrome.storage.local: settings / popup UI language (`en` | `zh`). */
export const SETTINGS_UI_LOCALE_KEY = "bridgegptSettingsUiLocale";

/** chrome.storage.local: OpenAI-style `api_key` for this extension (e.g. sk-bridgegpt-…). */
export const API_KEY_STORAGE_KEY = "bridgegptApiKey";

/** Older releases used this key; read once and migrate to {@link API_KEY_STORAGE_KEY}. */
export const LEGACY_ROOM_ID_STORAGE_KEY = "roomId";

const SK_BRIDGEGPT_PREFIX = "sk-bridgegpt-";
const SK_TAIL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** OpenAI-like secret: `sk-bridgegpt-` + 48 alphanumeric chars. */
export function generateBridgegptApiKey(): string {
  const len = 48;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let tail = "";
  for (let i = 0; i < len; i++) {
    tail += SK_TAIL_ALPHABET[bytes[i]! % SK_TAIL_ALPHABET.length];
  }
  return SK_BRIDGEGPT_PREFIX + tail;
}

export function normalizeRelayBase(url: string): string {
  const t = url.trim();
  return t.endsWith("/") ? t : `${t}/`;
}

/**
 * Public relay host (trailing slash). Shown in settings as “Built-in / production
 * default” regardless of build-time `VITE_API_BASE_URL`.
 */
export const OFFICIAL_RELAY_BASE_URL = normalizeRelayBase(
  "https://bridge.0bm.com/"
);

/**
 * Effective default when storage has no override. Set `VITE_API_BASE_URL` at
 * build for local/self-hosted relays; otherwise matches {@link OFFICIAL_RELAY_BASE_URL}.
 */
const viteRelay = import.meta.env.VITE_API_BASE_URL?.trim();
export const DEFAULT_RELAY_BASE_URL = normalizeRelayBase(
  viteRelay && viteRelay.length > 0 ? viteRelay : OFFICIAL_RELAY_BASE_URL
);

/** @deprecated Use {@link DEFAULT_RELAY_BASE_URL}; kept for imports that mean “build default”. */
export const API_BASE_URL = DEFAULT_RELAY_BASE_URL;

export function relayBaseFromStoredString(
  stored: string | undefined,
  fallback = DEFAULT_RELAY_BASE_URL
): string {
  if (typeof stored !== "string" || !stored.trim()) return fallback;
  try {
    const u = new URL(stored.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    const path = u.pathname === "" ? "/" : u.pathname;
    return normalizeRelayBase(`${u.origin}${path}`);
  } catch {
    return fallback;
  }
}
