import type { Request } from "express";

/**
 * Which browser tab the extension should drive. Clients set e.g.
 * `X-Bridge-Provider: gemini` or `grok` on POST /v1/chat/completions (default: chatgpt).
 */
export function bridgeWebProviderFromRequest(
  req: Request
): "chatgpt" | "gemini" | "grok" {
  const h = req.get("x-bridge-provider")?.trim().toLowerCase();
  if (h === "gemini") return "gemini";
  if (h === "grok") return "grok";
  return "chatgpt";
}
