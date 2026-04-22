import { chatgptPostToContent } from "./emit";

const MAX_SSE_SAMPLES = 48;
const MAX_DATA_LEN = 2000;

type ChatgptDomCapture = {
  assistantHtml: string;
  assistantText: string;
  key: string;
};

const EMPTY_DOM_CAPTURE: ChatgptDomCapture = {
  assistantHtml: "",
  assistantText: "",
  key: "",
};

/**
 * Only the SSE stream that follows `prepareNextChatgptRelaySseCapture()` (plugin
 * submit) should emit to the content script. Otherwise every manual chat on the
 * page would also trigger `question_answer` and `scheduleFreshChatIfTurnLimitReached`.
 */
let markNextEventStreamAsRelay = false;
let relayPrepResetTimer: number | undefined;

export function resetRelaySseGateForNewRun(): void {
  markNextEventStreamAsRelay = false;
  if (relayPrepResetTimer !== undefined) {
    window.clearTimeout(relayPrepResetTimer);
    relayPrepResetTimer = undefined;
  }
}

/** Call immediately before programmatic submit so the next SSE response is treated as relay output. */
export function prepareNextChatgptRelaySseCapture(): void {
  resetRelaySseGateForNewRun();
  markNextEventStreamAsRelay = true;
  relayPrepResetTimer = window.setTimeout(() => {
    markNextEventStreamAsRelay = false;
    relayPrepResetTimer = undefined;
  }, 180_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeAssistantText(text: string): string {
  return text.replace(/\u200b/g, "").trim();
}

function extractPatchText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => extractPatchText(item)).join("");
  }
  if (!value || typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;
  const directTextKeys = ["text", "value", "content", "result"];
  for (const key of directTextKeys) {
    const candidate = obj[key];
    const extracted = extractPatchText(candidate);
    if (extracted) return extracted;
  }
  return "";
}

function captureAssistantMessageEl(messageEl: HTMLElement): ChatgptDomCapture {
  const markdownRoot = messageEl.querySelector(".markdown") as HTMLElement | null;
  const root = markdownRoot ?? messageEl;
  const assistantHtml = markdownRoot?.innerHTML?.trim() ?? "";
  const assistantText = normalizeAssistantText(
    root.innerText || root.textContent || ""
  );
  const messageId = messageEl.getAttribute("data-message-id") ?? "";
  const key = `${messageId}::${assistantHtml || assistantText}`;

  if (!assistantHtml && !assistantText) return EMPTY_DOM_CAPTURE;

  return {
    assistantHtml,
    assistantText,
    key,
  };
}

function collectLatestAssistantDomCapture(): ChatgptDomCapture {
  const nodes = document.querySelectorAll('[data-message-author-role="assistant"]');
  for (let i = nodes.length - 1; i >= 0; i--) {
    const el = nodes[i];
    if (!(el instanceof HTMLElement)) continue;
    const capture = captureAssistantMessageEl(el);
    if (capture.key) return capture;
  }
  return EMPTY_DOM_CAPTURE;
}

async function waitForAssistantDomCaptureChange(
  previousKey: string,
  timeoutMs: number
): Promise<ChatgptDomCapture> {
  const endAt = Date.now() + timeoutMs;
  let lastSeen = EMPTY_DOM_CAPTURE;

  while (Date.now() < endAt) {
    const current = collectLatestAssistantDomCapture();
    if (current.key) lastSeen = current;
    if (current.key && current.key !== previousKey) return current;
    await sleep(120);
  }

  if (lastSeen.key && lastSeen.key !== previousKey) return lastSeen;
  return EMPTY_DOM_CAPTURE;
}

function pickPreferredAssistantText(
  sseText: string,
  domText: string
): "sse" | "dom" {
  if (domText.length > sseText.length) return "dom";
  return "sse";
}

/**
 * Phase: wait_capture — ChatGPT wraps `fetch`, reads SSE until the stream ends,
 * then emit via `chatgptPostToContent` (success path).
 */
export function installChatgptSseFetchCapture(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      return response;
    }

    const consumeRelay = markNextEventStreamAsRelay;
    if (consumeRelay) {
      markNextEventStreamAsRelay = false;
      if (relayPrepResetTimer !== undefined) {
        window.clearTimeout(relayPrepResetTimer);
        relayPrepResetTimer = undefined;
      }
    }

    if (!consumeRelay) {
      return response;
    }

    const clone = response.clone();
    const reader = clone.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    const beforeDomCapture = collectLatestAssistantDomCapture();

    let buffer = "";
    let fullAssistantMessage = "";
    let deltaPatchCount = 0;
    const sseSamples: { event: string; data: string }[] = [];
    const streamSignals: unknown[] = [];

    function pushSample(eventName: string | null, dataStr: string) {
      if (sseSamples.length >= MAX_SSE_SAMPLES) sseSamples.shift();
      sseSamples.push({
        event: eventName ?? "(default)",
        data: String(dataStr).slice(0, MAX_DATA_LEN),
      });
    }

    async function readStream() {
      while (true) {
        if (reader === undefined) return response;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() as string;

        for (let part of parts) {
          part = part.trim();
          if (!part) continue;

          const lines = part.split(/\r?\n/);

          let eventName: string | null = null;
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.substring("event:".length).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.substring("data:".length).trim());
            }
          }

          const dataStr = dataLines.join("\n");
          pushSample(eventName, dataStr);

          if (eventName === "delta" || eventName === "delta_encoding") {
            try {
              const obj = JSON.parse(dataStr);

              if (eventName === "delta") {
                if (Array.isArray(obj.v)) {
                  for (const patch of obj.v) {
                    if (
                      patch &&
                      typeof patch === "object" &&
                      patch.p &&
                      patch.v
                    ) {
                      const path = String(patch.p);
                      const op = String(patch.o ?? "");
                      if (
                        path.includes("/message/content") &&
                        (op === "append" || op === "replace" || op === "add")
                      ) {
                        const patchText = extractPatchText(patch.v);
                        if (patchText) {
                          fullAssistantMessage += patchText;
                          deltaPatchCount += 1;
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("Could not parse SSE data JSON:", dataStr, err);
              fullAssistantMessage += dataStr;
            }
          } else if (eventName === null) {
            try {
              const obj = JSON.parse(dataStr);
              if (obj && typeof obj === "object") {
                if (obj.type === "message_stream_complete") {
                  streamSignals.push({
                    type: "message_stream_complete",
                    snippet: JSON.stringify(obj).slice(0, 4000),
                  });
                } else {
                  streamSignals.push({
                    type: obj.type ?? "unknown",
                    snippet: JSON.stringify(obj).slice(0, 2000),
                  });
                }
              }
            } catch {
              // not JSON
            }
          }
        }
      }

      const sseAssistantText = fullAssistantMessage.trim();
      const domCapture = await waitForAssistantDomCaptureChange(
        beforeDomCapture.key,
        3000
      );
      const preferredSource = pickPreferredAssistantText(
        sseAssistantText,
        domCapture.assistantText
      );
      const assistantText =
        preferredSource === "dom" && domCapture.assistantText
          ? domCapture.assistantText
          : sseAssistantText;

      chatgptPostToContent({
        assistantHtml: domCapture.assistantHtml,
        assistantText,
        page: {
          href: typeof location !== "undefined" ? location.href : "",
          title: typeof document !== "undefined" ? document.title : "",
        },
        capture: {
          completedAt: new Date().toISOString(),
          deltaPatchCount,
          sseSampleCount: sseSamples.length,
          sseSamples,
          streamSignals: streamSignals.slice(-12),
          assistantTextSource: preferredSource,
          sseAssistantTextLength: sseAssistantText.length,
          domAssistantTextLength: domCapture.assistantText.length,
        },
      });
    }
    readStream().catch((err) => console.error("SSE read error:", err));
    return response;
  };
}
