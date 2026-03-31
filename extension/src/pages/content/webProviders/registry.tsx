import type { WebProviderId } from "@src/webProviders/config";
import type { ComponentType } from "react";
import { ChatgptWebProvider } from "./chatgptWeb/ChatgptWebProvider";
import { GeminiWebProvider } from "./geminiWeb/GeminiWebProvider";
import { GrokWebProvider } from "./grokWeb/GrokWebProvider";

export type ContentProviderSpec = {
  id: WebProviderId;
  Component: ComponentType;
};

/**
 * Maps the current page origin to a provider implementation.
 * When adding claude.ai: extend `WebProviderId`, manifest `matches`,
 * `WEB_PROVIDERS` in config, and return the new component here.
 */
export function resolveContentProvider(href: string): ContentProviderSpec | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const h = u.hostname.toLowerCase();
  if (
    h === "chatgpt.com" ||
    h.endsWith(".chatgpt.com") ||
    h === "chat.openai.com"
  ) {
    return { id: "chatgpt", Component: ChatgptWebProvider };
  }
  if (h === "gemini.google.com") {
    return { id: "gemini", Component: GeminiWebProvider };
  }
  if (h === "grok.com" || h.endsWith(".grok.com")) {
    return { id: "grok", Component: GrokWebProvider };
  }
  return null;
}
