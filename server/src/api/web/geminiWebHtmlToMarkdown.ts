import TurndownService from "turndown";

let service: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!service) {
    service = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
    });
  }
  return service;
}

/**
 * Convert Gemini web `.markdown` panel HTML (from the extension) to GFM-ish Markdown.
 * Runs on the relay so conversion rules can ship without a Chrome Web Store release.
 * (Symmetric role to `stripChatgptEntityMarkers` for ChatGPT stream text.)
 */
export function geminiWebHtmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  try {
    return getTurndown().turndown(trimmed).replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}
