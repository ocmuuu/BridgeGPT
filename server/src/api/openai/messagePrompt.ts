import { roughTokenCount } from "../shared/tokens.js";

export function normalizeMessageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return String(content ?? "");
}

/**
 * Plain text for the ChatGPT composer: message bodies only (no "user:" / role prefixes).
 * ChatGPT.com already keeps thread context, so only the latest user turn is injected —
 * sending the full messages[] would duplicate the entire history in the input box.
 */
export function buildPromptForChatgptWeb(route: string, body: unknown): string {
  if (
    route === "/v1/chat/completions" &&
    body &&
    typeof body === "object" &&
    "messages" in body
  ) {
    const msgs = (body as { messages?: unknown }).messages;
    if (Array.isArray(msgs) && msgs.length > 0) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m || typeof m !== "object") continue;
        const role = String((m as { role?: string }).role ?? "").toLowerCase();
        if (role !== "user") continue;
        const text = normalizeMessageContentToString(
          (m as { content?: unknown }).content
        ).trim();
        if (text) return text;
      }
      const parts: string[] = [];
      for (const m of msgs) {
        if (!m || typeof m !== "object") continue;
        const text = normalizeMessageContentToString(
          (m as { content?: unknown }).content
        ).trim();
        if (text) parts.push(text);
      }
      if (parts.length > 0) return parts.join("\n\n");
    }
  }
  return `Route: ${route}\nPayload: ${JSON.stringify(body)}`;
}

function estimatePromptTokensFromRequestBody(
  body: Record<string, unknown>
): number {
  const msgs = body.messages;
  let total = 0;
  if (Array.isArray(msgs)) {
    for (const m of msgs) {
      if (!m || typeof m !== "object") continue;
      const role = String((m as { role?: string }).role ?? "user");
      const text = normalizeMessageContentToString(
        (m as { content?: unknown }).content
      );
      total += roughTokenCount(role) + 3;
      total += roughTokenCount(text);
    }
  }
  const rest = { ...body };
  delete rest.messages;
  delete rest.model;
  delete rest.stream;
  const extra = JSON.stringify(rest);
  if (extra.length > 2) {
    total += roughTokenCount(extra);
  }
  return total;
}

export function buildUsage(
  requestBody: Record<string, unknown>,
  completionText: string
): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} {
  const prompt_tokens = estimatePromptTokensFromRequestBody(requestBody);
  const completion_tokens = roughTokenCount(completionText);
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
  };
}
