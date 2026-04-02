/**
 * Page-world script for chatgpt.com:
 * - Intercepts fetch/SSE and forwards assistant text when a stream completes.
 * - Fills the composer and submits via `runAsk` (same phase model as Gemini/Grok),
 *   triggered by `postMessage` from the content script. See `ChatgptWebProvider.tsx`.
 *
 * @see `./shared/providerPhaseModel.ts` — canonical Receive → … → Emit phase list.
 */
(function () {
  const SRC_PAGE = "bridgegpt-chatgpt-page";
  const SRC_CONTENT = "bridgegpt-content-script";
  const MSG_IN = "bridgegpt_chatgpt_run";

  const originalFetch = window.fetch;

  const MAX_SSE_SAMPLES = 48;
  const MAX_DATA_LEN = 2000;

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      return response;
    }

    const clone = response.clone();
    const reader = clone.body?.getReader();
    const decoder = new TextDecoder("utf-8");

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
                    if (patch.p && patch.o === "append" && patch.v) {
                      if (patch.p.includes("/message/content/parts")) {
                        fullAssistantMessage += patch.v;
                        deltaPatchCount += 1;
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

      /** Entity markers etc. are stripped on the relay in extractAssistantContent. */
      const assistantText = fullAssistantMessage.trim();

      const payload = {
        version: 1 as const,
        source: SRC_PAGE,
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
        },
      };

      window.postMessage({ data: payload }, "*");
    }
    readStream().catch((err) => console.error("SSE read error:", err));
    return response;
  };

  function postRunAskFailure(
    reason: string,
    startedAt: string
  ): void {
    window.postMessage(
      {
        data: {
          version: 1,
          source: SRC_PAGE,
          assistantText: "",
          page: {
            href: typeof location !== "undefined" ? location.href : "",
            title: typeof document !== "undefined" ? document.title : "",
          },
          capture: {
            startedAt,
            completedAt: new Date().toISOString(),
            ok: false,
            reason,
          },
        },
      },
      "*"
    );
  }

  /** Phase: resolve composer → fill → submit (capture phase is SSE hook above). */
  function runAsk(text: string): void {
    const startedAt = new Date().toISOString();
    const inputElement = document.querySelector(
      '[name="prompt-textarea"]'
    ) as HTMLInputElement | null;
    const contentArea = document.querySelector(
      "#prompt-textarea"
    ) as HTMLDivElement | null;
    if (!inputElement || !contentArea) {
      postRunAskFailure("dom_not_ready", startedAt);
      return;
    }
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (!trimmed) {
      postRunAskFailure("missing_prompt", startedAt);
      return;
    }
    contentArea.innerHTML = trimmed;
    inputElement.value = trimmed;
    window.setTimeout(() => {
      const submitButton = document.querySelector(
        "#composer-submit-button"
      ) as HTMLButtonElement | null;
      if (!submitButton) {
        postRunAskFailure("no_submit_button", startedAt);
        return;
      }
      submitButton.click();
    }, 100);
  }

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as {
      source?: string;
      type?: string;
      text?: string;
    } | null;
    if (!d || d.source !== SRC_CONTENT || d.type !== MSG_IN) return;
    const t = typeof d.text === "string" ? d.text : "";
    runAsk(t);
  });
})();
