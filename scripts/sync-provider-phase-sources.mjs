#!/usr/bin/env node
/**
 * 1) Embeds extension `providers/*` TypeScript into
 *    `server/src/data/providerPhaseDefaultSources.json` (optional API payload).
 * 2) Writes declarative `server/src/data/providerPhaseExecutionProfile.json`
 *    (no code — timeouts, protocol strings, primary selectors) for the default
 *    API response.
 *
 * Usage: `node scripts/sync-provider-phase-sources.mjs` from repo root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const providersRoot = path.join(
  repoRoot,
  "extension/src/pages/content/providers"
);

function readRaw(relFromProviders) {
  const full = path.join(providersRoot, relFromProviders);
  return fs.readFileSync(full, "utf8");
}

/** `export const NAME = "value";` */
function parseStringConsts(ts) {
  const o = {};
  for (const m of ts.matchAll(/export const (\w+) = "([^"]*)";/g)) {
    o[m[1]] = m[2];
  }
  return o;
}

function firstInt(text, regex) {
  const m = text.match(regex);
  return m ? Number(m[1]) : undefined;
}

/** First N querySelector string literals in file order (best-effort). */
function querySelectorLiterals(ts, limit = 20) {
  const out = [];
  const re = /querySelector(?:All)?\(\s*([`'"])((?:\\.|(?!\1)[^\\])*?)\1/g;
  for (const m of ts.matchAll(re)) {
    const q = m[2].replace(/\\(.)/g, "$1");
    if (!out.includes(q)) out.push(q);
    if (out.length >= limit) break;
  }
  return out;
}

function buildExecutionProfile() {
  const extPkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "extension/package.json"), "utf8")
  );
  const chatConst = parseStringConsts(readRaw("chatgpt/constants.ts"));
  const gemConst = parseStringConsts(readRaw("gemini/constants.ts"));
  const grokConst = parseStringConsts(readRaw("grok/constants.ts"));

  const chatResolve = readRaw("chatgpt/resolveComposer.ts");
  const chatSubmit = readRaw("chatgpt/submit.ts");
  const chatSse = readRaw("chatgpt/waitCaptureSse.ts");

  const gemRun = readRaw("gemini/runAsk.ts");
  const gemResolve = readRaw("gemini/resolveComposer.ts");

  const grokRun = readRaw("grok/runAsk.ts");

  const profile = {
    kind: "bridgegpt.provider_execution_profile",
    profileSchemaVersion: 1,
    generatedAt: new Date().toISOString(),
    phaseModelVersion: 1,
    extensionVersion: extPkg.version,
    about:
      "Structured, non-executable summary of default extension page-world behavior (wire protocol, timings, primary DOM hooks). Mirrors the shipped extension; regenerate with this script after editing providers/*.",
    shared: {
      contentScriptPostMessageSource: "bridgegpt-content-script",
      domPollPrimitives: {
        waitForDefaultIntervalMs: firstInt(
          readRaw("gemini/domHelpers.ts"),
          /intervalMs\s*=\s*(\d+)/
        ),
        note: "Gemini/Grok inline sleep/waitFor in provider domHelpers.ts (not shared chunks in page bundles).",
      },
    },
    providers: {
      chatgpt: {
        waitCaptureStrategy: "sse_intercept",
        pagePostMessage: {
          envelopeVersion: 1,
          sourcePage: chatConst.CHATGPT_SRC_PAGE,
          contentScriptSource: chatConst.CHATGPT_SRC_CONTENT,
          runMessageType: chatConst.CHATGPT_MSG_IN,
          textField: "text",
        },
        resolve_composer: {
          composerSelectors: querySelectorLiterals(chatResolve, 8),
        },
        fill: {
          strategy: "sync_hidden_input_and_contenteditable_innerHTML",
        },
        submit: {
          submitDelayMs: firstInt(
            chatSubmit,
            /setTimeout\([\s\S]*?,\s*(\d+)\)/
          ),
        },
        wait_capture: {
          trigger: "fetch_response_content_type_includes",
          contentTypeSubstring: "text/event-stream",
          maxSseSamples: firstInt(chatSse, /MAX_SSE_SAMPLES\s*=\s*(\d+)/),
          maxSampleDataLength: firstInt(chatSse, /MAX_DATA_LEN\s*=\s*(\d+)/),
          deltaEvents: ["delta", "delta_encoding"],
          assistantAppendPatch: {
            op: "append",
            jsonPointerMustInclude: "/message/content/parts",
          },
          streamSignalsKept: 12,
        },
      },
      gemini: {
        waitCaptureStrategy: "dom_poll",
        pagePostMessage: {
          envelopeVersion: 1,
          sourcePage: gemConst.GEMINI_SRC_PAGE,
          contentScriptSource: gemConst.GEMINI_SRC_CONTENT,
          runMessageType: gemConst.GEMINI_MSG_IN,
          textField: "text",
        },
        resolve_composer: {
          primarySelectorGroups: [
            "scoped input-area / footer ql-editor (ordered)",
            "rich-textarea combined ql-editor",
            "rich-textarea shadowRoot ql-editor",
            "global ql-editor / contenteditable with footer proximity",
          ],
          sampleSelectors: querySelectorLiterals(gemResolve, 16),
        },
        fill: {
          strategy: "trusted_types_safe_dom_paragraphs_plus_input_events",
        },
        submit: {
          strategy: "pointer_synthesis_and_enter_on_editor",
        },
        wait_capture: {
          waitComposerTimeoutMs: firstInt(
            gemRun,
            /waitFor\(findGeminiEditableRoot,\s*(\d+)\)/
          ),
          afterFillSleepMs: firstInt(gemRun, /await sleep\((\d+)\)/),
          findSendFallbackWaitMs: firstInt(
            gemRun,
            /waitFor\(findGeminiSendButton,\s*(\d+)\)/
          ),
          pollIntervalMs: firstInt(gemRun, /const pollMs = (\d+)/),
          maxPollTicks: firstInt(gemRun, /const maxTicks = (\d+)/),
          stableTicksWhenUiIdle: 2,
          stableTicksWhenBusy: 4,
          usesConversationScopedCapture: true,
          captureFields: ["assistantHtml", "assistantText"],
        },
      },
      grok: {
        waitCaptureStrategy: "dom_poll",
        pagePostMessage: {
          envelopeVersion: 1,
          sourcePage: grokConst.GROK_SRC_PAGE,
          contentScriptSource: grokConst.GROK_SRC_CONTENT,
          runMessageType: grokConst.GROK_MSG_IN,
          textField: "text",
        },
        resolve_composer: {
          strategy: "prefer_prose_in_main_form_then_textarea_then_fallback",
        },
        fill: {
          textareaVsProse: true,
        },
        submit: {
          strategy: "visible_form_submit_or_mod_enter_then_enter",
        },
        wait_capture: {
          waitComposerTimeoutMs: firstInt(
            grokRun,
            /waitFor\(pickGrokComposer,\s*(\d+)/
          ),
          waitComposerIntervalMs: firstInt(
            grokRun,
            /waitFor\(pickGrokComposer,\s*\d+,\s*(\d+)\)/
          ),
          pollIntervalMs: firstInt(grokRun, /const pollMs = (\d+)/),
          maxPollTicks: firstInt(grokRun, /const maxTicks = (\d+)/),
          stableTicksByReplyLength: [
            { maxLenExclusive: 80, ticks: 12 },
            { maxLenExclusive: 240, ticks: 8 },
            { maxLenExclusive: null, ticks: 4 },
          ],
          previewSnippetHeuristics: {
            maxReplyLenConsidered: 200,
            maxReplyLenForShortAsciiPreview: 180,
            minNonAsciiRatioForCjkPrompt: 0.15,
          },
          captureFields: ["assistantText"],
        },
      },
    },
  };

  const submitSel = chatSubmit.match(
    /querySelector\(\s*["']([^"']+)["']\s*\)\s*as HTMLButtonElement/
  );
  if (submitSel) {
    profile.providers.chatgpt.submit.submitControlSelector = submitSel[1];
  }

  const gemSends = [...gemRun.matchAll(/waitForGeminiEnabledSendButton\((\d+)/g)];
  if (gemSends[0]) {
    profile.providers.gemini.wait_capture.sendButtonWaitPrimaryMs = Number(
      gemSends[0][1]
    );
  }
  if (gemSends[1]) {
    profile.providers.gemini.wait_capture.sendButtonWaitRetryMs = Number(
      gemSends[1][1]
    );
  }

  const grokSleep = grokRun.match(
    /await sleep\(kind === "prose" \? (\d+) : (\d+)\)/
  );
  if (grokSleep) {
    profile.providers.grok.wait_capture.afterFillSleepProseMs = Number(
      grokSleep[1]
    );
    profile.providers.grok.wait_capture.afterFillSleepTextareaMs = Number(
      grokSleep[2]
    );
  }

  return profile;
}

function read(relFromProviders) {
  const rel = relFromProviders.replace(/\\/g, "/");
  const full = path.join(providersRoot, relFromProviders);
  const typescript = fs.readFileSync(full, "utf8");
  return {
    relativePath: `extension/src/pages/content/providers/${rel}`,
    typescript,
  };
}

const body = {
  generatedAt: new Date().toISOString(),
  phaseModelVersion: 1,
  shared: {
    dom: read("shared/dom.ts"),
  },
  providers: {
    chatgpt: {
      constants: read("chatgpt/constants.ts"),
      receive: read("chatgpt/receive.ts"),
      resolve_composer: read("chatgpt/resolveComposer.ts"),
      fill: read("chatgpt/fill.ts"),
      submit: read("chatgpt/submit.ts"),
      /** Orchestrates resolve → fill → submit for one ask. */
      run_ask: read("chatgpt/runAsk.ts"),
      wait_capture: read("chatgpt/waitCaptureSse.ts"),
      emit_failure: read("chatgpt/emitFailure.ts"),
      mount: read("chatgpt/mount.ts"),
    },
    gemini: {
      constants: read("gemini/constants.ts"),
      receive: read("gemini/receive.ts"),
      resolve_composer: read("gemini/resolveComposer.ts"),
      fill: read("gemini/fill.ts"),
      submit: read("gemini/submit.ts"),
      run_ask: read("gemini/runAsk.ts"),
      wait_capture: read("gemini/capture.ts"),
      emit: read("gemini/emit.ts"),
      mount: read("gemini/mount.ts"),
      dom_helpers: read("gemini/domHelpers.ts"),
    },
    grok: {
      constants: read("grok/constants.ts"),
      receive: read("grok/receive.ts"),
      resolve_composer: read("grok/resolveComposer.ts"),
      fill: read("grok/fill.ts"),
      submit: read("grok/submit.ts"),
      run_ask: read("grok/runAsk.ts"),
      wait_capture: read("grok/capture.ts"),
      emit: read("grok/emit.ts"),
      mount: read("grok/mount.ts"),
      dom_helpers: read("grok/domHelpers.ts"),
    },
  },
};

const outDir = path.join(repoRoot, "server/src/data");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "providerPhaseDefaultSources.json");
fs.writeFileSync(outFile, `${JSON.stringify(body, null, 2)}\n`, "utf8");
console.log("Wrote", path.relative(repoRoot, outFile));

const profileFile = path.join(outDir, "providerPhaseExecutionProfile.json");
const profileBody = buildExecutionProfile();
fs.writeFileSync(profileFile, `${JSON.stringify(profileBody, null, 2)}\n`, "utf8");
console.log("Wrote", path.relative(repoRoot, profileFile));
