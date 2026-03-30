/**
 * ChatGPT (chatgpt.com) streams inline "entity" payloads for the web UI to render
 * as links — e.g. text around `entity["city","香港","中国特别行政区"]`, often wrapped
 * in fullwidth parens and/or Unicode private-use delimiters (U+E000–U+F8FF).
 * API clients should not see these; strip in `extractAssistantContent` before packaging
 * OpenAI-style responses. (Symmetric role to `geminiWebHtmlToMarkdown` for Gemini DOM HTML.)
 */
export function stripChatgptEntityMarkers(input: string): string {
  if (!input) return input;
  const lower = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < input.length) {
    const pos = lower.indexOf("entity[", i);
    if (pos === -1) {
      out += input.slice(i);
      break;
    }
    let start = pos;
    let k = pos - 1;
    while (k >= i) {
      const ch = input[k];
      if (/[\uE000-\uF8FF]/.test(ch)) {
        start = k;
        k--;
        continue;
      }
      if (ch === "（" || ch === "(") {
        start = k;
        k--;
        while (k >= i && /[\uE000-\uF8FF]/.test(input[k])) {
          start = k;
          k--;
        }
        break;
      }
      break;
    }
    out += input.slice(i, start);
    const openBracket = input.indexOf("[", pos);
    if (openBracket === -1) {
      out += input.slice(pos);
      break;
    }
    let depth = 0;
    let j = openBracket;
    for (; j < input.length; j++) {
      const c = input[j];
      if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    let end = j;
    while (end < input.length && /[\uE000-\uF8FF\s]/.test(input[end])) {
      end++;
    }
    if (end < input.length && (input[end] === "）" || input[end] === ")")) {
      end++;
    }
    i = end;
  }
  return out;
}
