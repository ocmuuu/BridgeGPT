import { roughTokenCount } from "../shared/tokens.js";

function geminiTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const out: string[] = [];
  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    if (
      "text" in p &&
      typeof (p as { text?: unknown }).text === "string"
    ) {
      const t = (p as { text: string }).text.trim();
      if (t) out.push(t);
    }
  }
  return out.join("\n");
}

function geminiContentToText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  return geminiTextFromParts((content as { parts?: unknown }).parts);
}

/**
 * Latest user turn for gemini.google.com (thread context stays in the tab).
 * Emitted as `promptForChatgpt` on every relay → extension request; the extension does not
 * duplicate this logic.
 */
export function buildPromptForGeminiWeb(body: unknown): string {
  if (!body || typeof body !== "object") {
    return String(body ?? "");
  }
  const b = body as Record<string, unknown>;
  const prefixParts: string[] = [];
  const sys = b.systemInstruction;
  if (sys && typeof sys === "object") {
    const st = geminiContentToText(sys);
    if (st) prefixParts.push(st);
  }
  const contents = b.contents;
  if (!Array.isArray(contents) || contents.length === 0) {
    const fallback = `Gemini request (no contents): ${JSON.stringify(body)}`;
    return prefixParts.length > 0
      ? `${prefixParts.join("\n\n")}\n\n${fallback}`
      : fallback;
  }
  for (let i = contents.length - 1; i >= 0; i--) {
    const c = contents[i];
    if (!c || typeof c !== "object") continue;
    const role = String((c as { role?: string }).role ?? "user").toLowerCase();
    if (role !== "user") continue;
    const text = geminiTextFromParts((c as { parts?: unknown }).parts).trim();
    if (text) {
      return prefixParts.length > 0
        ? `${prefixParts.join("\n\n")}\n\n${text}`
        : text;
    }
  }
  const all: string[] = [];
  for (const c of contents) {
    if (!c || typeof c !== "object") continue;
    const t = geminiTextFromParts((c as { parts?: unknown }).parts).trim();
    if (t) all.push(t);
  }
  const joined = all.join("\n\n");
  if (joined) {
    return prefixParts.length > 0
      ? `${prefixParts.join("\n\n")}\n\n${joined}`
      : joined;
  }
  return prefixParts.length > 0
    ? prefixParts.join("\n\n")
    : JSON.stringify(body);
}

export function estimateGeminiPromptTokens(body: Record<string, unknown>): number {
  return roughTokenCount(JSON.stringify(body.contents ?? [])) + 8;
}
