/**
 * ChatGPT (chatgpt.com) streams inline "entity" payloads for the web UI to render
 * as links — e.g. text around `entity["city","香港","中国特别行政区"]`, often wrapped
 * in fullwidth parens and/or Unicode private-use delimiters (U+E000–U+F8FF).
 * The web UI often inserts PUA characters *between* the word `entity` and the opening
 * `[` (e.g. `entity` + U+E201 + `["software",…]`), so a plain `entity[` substring match
 * misses those and leaks markers to API clients.
 *
 * Strips in `extractAssistantContent` before packaging OpenAI-style responses.
 * (Symmetric role to `geminiWebHtmlToMarkdown` for Gemini DOM HTML.)
 */

const ENTITY_LEN = "entity".length;

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/** PUA + whitespace gap allowed between `entity` and `[`. */
const GAP_AFTER_ENTITY = /[\uE000-\uF8FF\s]/;

/**
 * Find the next removable entity block starting at or after `from`.
 * Returns `[blockStart, afterBlock)` — slice `[blockStart, afterBlock)` is removed.
 */
function findNextEntityBlock(
  input: string,
  lower: string,
  from: number
): { blockStart: number; afterBlock: number } | null {
  let search = from;
  while (search < input.length) {
    const pos = lower.indexOf("entity", search);
    if (pos === -1) return null;

    let j = pos + ENTITY_LEN;
    const gapStart = j;
    while (j < input.length && GAP_AFTER_ENTITY.test(input[j]!)) j++;
    const hasPuaOrWsGap = j > gapStart;

    if (j >= input.length || input[j] !== "[") {
      search = pos + 1;
      continue;
    }

    // Avoid stripping "identity[…]" etc.: only when `entity` abuts `[` with no gap.
    if (!hasPuaOrWsGap && pos > 0 && isAsciiLetter(input.charCodeAt(pos - 1))) {
      search = pos + 1;
      continue;
    }

    const openBracket = j;
    let depth = 0;
    let k = openBracket;
    for (; k < input.length; k++) {
      const c = input[k]!;
      if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) {
          k++;
          break;
        }
      }
    }
    if (depth !== 0) {
      search = pos + 1;
      continue;
    }

    let end = k;
    while (end < input.length && /[\uE000-\uF8FF\s]/.test(input[end]!)) end++;
    if (end < input.length && (input[end] === "）" || input[end] === ")")) end++;

    let blockStart = pos;
    let b = pos - 1;
    while (b >= from) {
      const ch = input[b]!;
      if (/[\uE000-\uF8FF]/.test(ch)) {
        blockStart = b;
        b--;
        continue;
      }
      if (ch === "（" || ch === "(") {
        blockStart = b;
        b--;
        while (b >= from && /[\uE000-\uF8FF]/.test(input[b]!)) {
          blockStart = b;
          b--;
        }
        break;
      }
      break;
    }

    return { blockStart, afterBlock: end };
  }
  return null;
}

export function stripChatgptEntityMarkers(input: string): string {
  if (!input) return input;
  const lower = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < input.length) {
    const found = findNextEntityBlock(input, lower, i);
    if (!found) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, found.blockStart);
    i = found.afterBlock;
  }
  return out;
}
