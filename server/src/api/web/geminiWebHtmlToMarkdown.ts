import TurndownService from "turndown";
// GFM table rules only (Gemini wraps tables in <table-block> with footer buttons).
import { tables } from "turndown-plugin-gfm";

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
    service.use(tables);
  }
  return service;
}

/** Gemini Angular shell: keep inner <table> only so Turndown does not ingest footer UI. */
function unwrapGeminiTableBlocks(html: string): string {
  return html.replace(
    /<table-block\b[^>]*>([\s\S]*?)<\/table-block>/gi,
    (_full, inner: string) => {
      const m = inner.match(/<table\b[^>]*>[\s\S]*?<\/table>/i);
      return m ? m[0] : "";
    }
  );
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
    const prepared = unwrapGeminiTableBlocks(trimmed);
    return getTurndown()
      .turndown(prepared)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}
