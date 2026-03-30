/** Plain text for the web composer (latest user turn). Keep in sync with server buildPromptForChatgptWeb. */

function normalizeMessageContent(content: unknown): string {
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

function geminiPartsToPlain(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const out: string[] = [];
  for (const p of parts) {
    if (p && typeof p === "object" && "text" in p) {
      const t = String((p as { text?: unknown }).text ?? "").trim();
      if (t) out.push(t);
    }
  }
  return out.join("\n");
}

function buildPromptFromGeminiContents(body: Record<string, unknown>): string | null {
  const contents = body.contents;
  if (!Array.isArray(contents)) return null;
  const prefix: string[] = [];
  const sys = body.systemInstruction;
  if (sys && typeof sys === "object" && "parts" in sys) {
    const st = geminiPartsToPlain((sys as { parts?: unknown }).parts);
    if (st) prefix.push(st);
  }
  for (let i = contents.length - 1; i >= 0; i--) {
    const c = contents[i];
    if (!c || typeof c !== "object") continue;
    const role = String((c as { role?: string }).role ?? "user").toLowerCase();
    if (role !== "user") continue;
    const text = geminiPartsToPlain(
      (c as { parts?: unknown }).parts
    ).trim();
    if (text) {
      return prefix.length > 0 ? `${prefix.join("\n\n")}\n\n${text}` : text;
    }
  }
  const all: string[] = [];
  for (const c of contents) {
    if (!c || typeof c !== "object") continue;
    const t = geminiPartsToPlain((c as { parts?: unknown }).parts).trim();
    if (t) all.push(t);
  }
  const joined = all.join("\n\n");
  if (joined) {
    return prefix.length > 0 ? `${prefix.join("\n\n")}\n\n${joined}` : joined;
  }
  return prefix.length > 0 ? prefix.join("\n\n") : null;
}

export function buildWebPromptFromApiBody(route: string, body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    (route.includes(":generateContent") ||
      route.includes(":streamGenerateContent"))
  ) {
    const g = buildPromptFromGeminiContents(body as Record<string, unknown>);
    if (g !== null) return g;
  }
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
        const text = normalizeMessageContent(
          (m as { content?: unknown }).content
        ).trim();
        if (text) return text;
      }
      const parts: string[] = [];
      for (const m of msgs) {
        if (!m || typeof m !== "object") continue;
        const text = normalizeMessageContent(
          (m as { content?: unknown }).content
        ).trim();
        if (text) parts.push(text);
      }
      if (parts.length > 0) return parts.join("\n\n");
    }
  }
  return `Route: ${route}\nPayload: ${JSON.stringify(body)}`;
}
