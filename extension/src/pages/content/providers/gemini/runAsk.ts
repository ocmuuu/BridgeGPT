import { sleep, waitFor } from "./domHelpers";
import {
  collectGeminiModelReplyForPrompt,
  collectGeminiModelReplyGlobal,
  geminiCaptureKey,
  isGeminiMarkdownIdleForPrompt,
  normalizeGeminiChatPrompt,
  type GeminiAssistantCapture,
} from "./capture";
import { fillGeminiQuillEditor } from "./fill";
import { geminiPostToContent } from "./emit";
import { findGeminiEditableRoot } from "./resolveComposer";
import {
  findGeminiSendButton,
  isGeminiSendButtonDisabled,
  queryGeminiSendButton,
  queryGeminiSendButtonNearEditor,
  submitGeminiComposer,
  waitForGeminiEnabledSendButton,
} from "./submit";

/** Orchestrates resolve → fill → submit → wait_capture → emit. */
export async function runGeminiAsk(text: string): Promise<void> {
  const captureBase: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
  };

  const editable = await waitFor(findGeminiEditableRoot, 20000);
  if (!editable) {
    geminiPostToContent({
      assistantHtml: "",
      assistantText: "",
      capture: { ...captureBase, ok: false, reason: "no_input" },
      page: { href: location.href, title: document.title },
    });
    return;
  }

  fillGeminiQuillEditor(editable, text);

  await sleep(120);
  let btn =
    (await waitForGeminiEnabledSendButton(12000, editable)) ??
    queryGeminiSendButtonNearEditor(editable) ??
    (await waitFor(findGeminiSendButton, 2000)) ??
    findGeminiSendButton();
  if (!btn) {
    geminiPostToContent({
      assistantHtml: "",
      assistantText: "",
      capture: { ...captureBase, ok: false, reason: "no_send_button" },
      page: { href: location.href, title: document.title },
    });
    return;
  }
  if (isGeminiSendButtonDisabled(btn)) {
    fillGeminiQuillEditor(editable, text);
    await sleep(200);
    btn =
      (await waitForGeminiEnabledSendButton(8000, editable)) ??
      queryGeminiSendButtonNearEditor(editable) ??
      queryGeminiSendButton() ??
      btn;
  }
  if (!btn || isGeminiSendButtonDisabled(btn)) {
    geminiPostToContent({
      assistantHtml: "",
      assistantText: "",
      capture: {
        ...captureBase,
        ok: false,
        reason: "send_button_stayed_disabled",
      },
      page: { href: location.href, title: document.title },
    });
    return;
  }
  const near = queryGeminiSendButtonNearEditor(editable);
  if (near && !isGeminiSendButtonDisabled(near)) {
    btn = near;
  }
  await submitGeminiComposer(editable, btn);

  let lastKey = "";
  let lastCapture: GeminiAssistantCapture = {
    assistantHtml: "",
    assistantText: "",
  };
  let stableTicks = 0;
  const maxTicks = 600;
  const pollMs = 200;
  const promptNorm = normalizeGeminiChatPrompt(text);
  const pickCapture = () =>
    promptNorm
      ? collectGeminiModelReplyForPrompt(text)
      : collectGeminiModelReplyGlobal();
  const pickIdle = () =>
    promptNorm ? isGeminiMarkdownIdleForPrompt(text) : false;

  for (let i = 0; i < maxTicks; i++) {
    await sleep(pollMs);
    const cap = pickCapture();
    const key = geminiCaptureKey(cap);
    if (key) lastCapture = cap;
    if (key && key === lastKey) stableTicks += 1;
    else {
      stableTicks = 0;
      lastKey = key;
    }
    const uiIdle = pickIdle();
    const needStable = uiIdle ? 2 : 4;
    if (stableTicks >= needStable && key.length > 0) {
      geminiPostToContent({
        assistantHtml: cap.assistantHtml,
        assistantText: cap.assistantText,
        capture: {
          ...captureBase,
          completedAt: new Date().toISOString(),
          stableTicks,
          pollTicks: i,
          uiIdle,
        },
        page: { href: location.href, title: document.title },
      });
      return;
    }
  }

  const finalCap = pickCapture();
  const use = geminiCaptureKey(finalCap) ? finalCap : lastCapture;
  geminiPostToContent({
    assistantHtml: use.assistantHtml,
    assistantText: use.assistantText,
    capture: {
      ...captureBase,
      completedAt: new Date().toISOString(),
      reason: "timeout_or_partial",
      pollTicks: maxTicks,
    },
    page: { href: location.href, title: document.title },
  });
}
