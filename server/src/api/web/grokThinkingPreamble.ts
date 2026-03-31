/**
 * Grok web UI may prepend a timing line (e.g. 思考了2s / Thought for 2s) before the answer.
 * Strip one leading line of that form and following blank lines so API clients see clean text.
 */
const NUM = String.raw`\d+(?:\.\d+)?`;
const GROK_THINKING_FIRST_LINE = new RegExp(
  String.raw`^\s*(?:思考了\s*${NUM}\s*(?:s|秒)\.?|Thought\s+for\s+${NUM}\s*(?:s|secs?|seconds?)\.?|Thinking\s+for\s+${NUM}\s*(?:s|secs?|seconds?)\.?)\s*(?:\r?\n)+`,
  "iu"
);

export function stripGrokThinkingPreamble(text: string): string {
  if (!text) return text;
  return text.replace(GROK_THINKING_FIRST_LINE, "").trimStart();
}
