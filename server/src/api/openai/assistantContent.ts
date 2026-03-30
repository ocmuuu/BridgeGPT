import { stripChatgptEntityMarkers } from "../web/chatgptWebEntityMarkers.js";
import { geminiWebHtmlToMarkdown } from "../web/geminiWebHtmlToMarkdown.js";

/**
 * Extract assistant plain text from extension payload (extra fields for debugging only).
 * Gemini sends `assistantHtml` (markdown panel innerHTML); conversion runs here so the
 * relay can improve rules without a new extension release.
 */
export function extractAssistantContent(message: unknown): string {
  if (message === null || message === undefined) return "";
  if (typeof message === "object" && message !== null) {
    const o = message as Record<string, unknown>;
    const html = o.assistantHtml;
    if (typeof html === "string" && html.trim()) {
      const md = geminiWebHtmlToMarkdown(html);
      if (md.trim()) return stripChatgptEntityMarkers(md);
    }
  }
  let raw = "";
  if (typeof message === "string") raw = message;
  else if (typeof message !== "object") raw = String(message);
  else {
    const o = message as Record<string, unknown>;
    for (const key of ["assistantText", "text", "content", "message"] as const) {
      const v = o[key];
      if (typeof v === "string") {
        raw = v;
        break;
      }
    }
    if (!raw) {
      const choices = o.choices;
      if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
        const m = (choices[0] as { message?: { content?: unknown } }).message;
        if (m && typeof m.content === "string") raw = m.content;
      }
    }
  }
  return stripChatgptEntityMarkers(raw);
}
