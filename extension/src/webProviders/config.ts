/**
 * Supported web UIs the extension can drive. Add new entries here and implement
 * the matching content script + (optional) page-world script.
 */
export type WebProviderId = "chatgpt" | "gemini" | "grok";

export type WebProviderConfig = {
  id: WebProviderId;
  /** Human-readable label for logs / UI */
  label: string;
  /** Tab URL must start with one of these (normalized lowercase). */
  urlPrefixes: string[];
  /** Patterns for chrome.tabs.query({ url }) — first match wins. */
  tabsQueryPatterns: string[];
  /** Open when no suitable tab exists */
  startUrl: string;
  /** chrome.storage.session key for last-used tab */
  sessionTabKey: string;
};

export const WEB_PROVIDERS: Record<WebProviderId, WebProviderConfig> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    urlPrefixes: [
      "https://chatgpt.com/",
      "https://www.chatgpt.com/",
      "https://chat.openai.com/",
    ],
    tabsQueryPatterns: [
      "https://chatgpt.com/*",
      "https://www.chatgpt.com/*",
      "https://chat.openai.com/*",
    ],
    startUrl: "https://chatgpt.com/",
    sessionTabKey: "bridgegptTab_chatgpt",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    urlPrefixes: ["https://gemini.google.com/"],
    tabsQueryPatterns: ["https://gemini.google.com/*"],
    startUrl: "https://gemini.google.com/",
    sessionTabKey: "bridgegptTab_gemini",
  },
  grok: {
    id: "grok",
    label: "Grok",
    urlPrefixes: ["https://grok.com/", "https://www.grok.com/"],
    tabsQueryPatterns: ["https://grok.com/*", "https://www.grok.com/*"],
    startUrl: "https://grok.com/",
    sessionTabKey: "bridgegptTab_grok",
  },
};

export function normalizeWebProviderId(raw: unknown): WebProviderId {
  const s = String(raw ?? "chatgpt")
    .trim()
    .toLowerCase();
  if (s === "gemini") return "gemini";
  if (s === "grok") return "grok";
  return "chatgpt";
}

export function tabUrlMatchesProvider(
  tabUrl: string | undefined,
  provider: WebProviderId
): boolean {
  if (!tabUrl) return false;
  const u = tabUrl.toLowerCase();
  return WEB_PROVIDERS[provider].urlPrefixes.some((p) => u.startsWith(p));
}
