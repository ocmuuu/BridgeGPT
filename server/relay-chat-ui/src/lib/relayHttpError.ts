/** Parse JSON error bodies from OpenAI-style and Gemini-style relay responses. */
export function parseRelayHttpErrorBody(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Unknown error";
  try {
    const j = JSON.parse(trimmed) as {
      error?: { message?: unknown; code?: unknown };
    };
    const m = j.error?.message;
    if (typeof m === "string" && m.trim()) return m.trim();
  } catch {
    /* plain text */
  }
  return trimmed;
}

/** User-facing line(s) for the web chat error strip (Chinese hint + server text). */
export function formatRelayChatHttpError(status: number, rawBody: string): string {
  const msg = parseRelayHttpErrorBody(rawBody);
  if (status === 503) {
    return (
      "扩展未连接（503）：当前 api_key 在中继上没有在线的 Chrome 扩展，或 room 内无客户端。\n\n" +
      msg
    );
  }
  if (status === 401) {
    return "凭据无效或未提供（401）\n\n" + msg;
  }
  return `请求失败（${status}）\n\n${msg}`;
}
