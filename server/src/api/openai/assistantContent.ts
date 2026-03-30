/**
 * Extract assistant plain text from extension payload (extra fields for debugging only).
 */
export function extractAssistantContent(message: unknown): string {
  if (message === null || message === undefined) return "";
  if (typeof message === "string") return message;
  if (typeof message !== "object") return String(message);
  const o = message as Record<string, unknown>;
  for (const key of ["assistantText", "text", "content", "message"] as const) {
    const v = o[key];
    if (typeof v === "string") return v;
  }
  const choices = o.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const m = (choices[0] as { message?: { content?: unknown } }).message;
    if (m && typeof m.content === "string") return m.content;
  }
  return "";
}
