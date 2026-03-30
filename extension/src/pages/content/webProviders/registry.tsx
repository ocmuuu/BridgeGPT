import type { WebProviderId } from "@src/webProviders/config";
import type { ComponentType } from "react";
import { ChatgptPage } from "./chatgpt/ChatgptPage";
import { GeminiPage } from "./gemini/GeminiPage";

export type ContentProviderSpec = {
  id: WebProviderId;
  Component: ComponentType;
};

/**
 * Maps the current page origin to a provider implementation.
 * When adding grok.com / claude.ai: extend `WebProviderId`, manifest `matches`,
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
    return { id: "chatgpt", Component: ChatgptPage };
  }
  if (h === "gemini.google.com") {
    return { id: "gemini", Component: GeminiPage };
  }
  return null;
}
