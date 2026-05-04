import { sleep, waitFor } from "./domHelpers";
import {
  collectGrokLatestAssistantPlain,
  grokStableTicksNeeded,
  isGrokAssistantBoilerplate,
  isGrokLatestAssistantResponseComplete,
  isLikelyGrokPreviewSnippet,
  normalizeGrokChat,
} from "./capture";
import { fillGrokProseMirror, fillGrokTextarea } from "./fill";
import { grokPostToContent } from "./emit";
import { pickGrokComposer } from "./resolveComposer";
import { submitGrokFilled } from "./submit";

/**
 * Serial queue: concurrent relay requests are processed one-at-a-time.
 */
let _runQueue: Promise<void> = Promise.resolve();

export function runGrokAsk(text: string): void {
  _runQueue = _runQueue.then(() => _doRunGrokAsk(text)).catch(() => {});
}

async function _doRunGrokAsk(text: string): Promise<void> {
  const captureBase: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
  };

  const picked = await waitFor(pickGrokComposer, 28000, 140);
  if (!picked) {
    grokPostToContent({
      assistantText: "",
      capture: { ...captureBase, ok: false, reason: "no_input" },
      page: { href: location.href, title: document.title },
    });
    return;
  }

  const { el: composer, kind, form } = picked;
  if (kind === "textarea") {
    fillGrokTextarea(composer as HTMLTextAreaElement, text);
  } else {
    fillGrokProseMirror(composer, text);
  }

  await sleep(kind === "prose" ? 450 : 200);

  const want = normalizeGrokChat(text);
  const before = collectGrokLatestAssistantPlain(want);
  await submitGrokFilled(composer, form, kind);
  let lastText = "";
  let stableTicks = 0;
  const maxTicks = 600;
  const pollMs = 200;

  for (let i = 0; i < maxTicks; i++) {
    await sleep(pollMs);
    let cur = collectGrokLatestAssistantPlain(want);
    if (isGrokAssistantBoilerplate(cur)) {
      cur = "";
    }
    if (!cur || cur === before) continue;
    if (want && normalizeGrokChat(cur) === want) continue;
    if (cur === lastText) stableTicks += 1;
    else {
      stableTicks = 0;
      lastText = cur;
    }
    const needStable = grokStableTicksNeeded(cur.length);
    const previewSnip = isLikelyGrokPreviewSnippet(text, cur);
    const isComplete = isGrokLatestAssistantResponseComplete();
    if (
      isComplete &&
      stableTicks >= needStable &&
      cur.length > 0 &&
      !previewSnip
    ) {
      grokPostToContent({
        assistantText: cur,
        capture: {
          ...captureBase,
          completedAt: new Date().toISOString(),
          stableTicks,
          pollTicks: i,
          isComplete,
        },
        page: { href: location.href, title: document.title },
      });
      return;
    }
  }

  let final = collectGrokLatestAssistantPlain(want);
  if (isGrokAssistantBoilerplate(final)) final = "";
  const use =
    final &&
    final !== before &&
    (!want || normalizeGrokChat(final) !== want)
      ? final
      : lastText;
  grokPostToContent({
    assistantText: use,
    capture: {
      ...captureBase,
      completedAt: new Date().toISOString(),
      reason: "timeout_or_partial",
      pollTicks: maxTicks,
    },
    page: { href: location.href, title: document.title },
  });
}
