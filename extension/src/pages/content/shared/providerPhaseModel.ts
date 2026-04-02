/**
 * # Provider phase model (ChatGPT / Gemini / Grok)
 *
 * All three web providers follow the same **ordered phases** below. Implementation
 * lives in page-world scripts (`*-page.js`) plus content `*WebProvider.tsx`.
 * This file is the **canonical description** — nothing imports it for runtime
 * behavior (bundles unchanged unless you choose to import it).
 *
 * Relay discovery:
 * - `GET {relayBase}extension/version` — `{ extension, relay }` semver; background
 *   uses this for update hints.
 * - `GET {relayBase}extension/provider-phase-config` — phase list, strategies, and
 *   **`providerExecutionProfile`** (structured protocol/timeouts/selectors, no code).
 *   Full per-phase TypeScript only with `?include=typescript_sources`.
 * Regenerate JSON via `npm run gen:provider-sources` after editing `providers/*`.
 * See `server/src/api/extension/providerPhaseConfig.ts` and `relayVersion.ts`.
 *
 * ---
 *
 * ## Phases
 *
 * 1. **Receive** — Obtain the user `text` to send and optional **relay metadata**
 *    (`route`, `body` for the pending request). Today: content script handles
 *    `chrome.runtime` `ask_question`, stores relay ref, and signals the page via
 *    `window.postMessage` (`bridgegpt-content-script` + per-site `*_run` type).
 *
 * 2. **Resolve composer** — Find the live input surface (selectors, shadow DOM,
 *    “last visible” composer, form scope). **Site-specific**; future remote
 *    config would mostly target this phase.
 *
 * 3. **Fill** — Write `text` and dispatch events the SPA expects (Quill,
 *    ProseMirror, plain textarea, ChatGPT’s `#prompt-textarea` + hidden input).
 *    **Site-specific**.
 *
 * 4. **Submit** — Click send, synthesize pointer/keyboard (Angular Material),
 *    or Mod+Enter (Grok). **Site-specific**.
 *
 * 5. **Wait / capture** — Decide when “this turn’s reply” is ready:
 *    - **ChatGPT**: `fetch` wrapper in `providers/chatgpt/capture.ts` reads **SSE**
 *      until the stream ends; parses `delta` patches (no DOM polling for the answer body).
 *    - **Gemini / Grok**: **poll DOM** + stable ticks + per-site idle / boilerplate
 *      / preview heuristics.
 *    **Mostly site-specific**; ChatGPT uses a different **strategy** (SSE) than
 *    DOM polling even though the phase name is the same.
 *
 * 6. **Emit** — `window.postMessage` to the content script with a payload aligned
 *    with `QuestionAnswerPayload` in `./relayTypes.ts` (`assistantText`, optional
 *    `assistantHtml`, `capture`, `page`, `version`, `source`). Content attaches
 *    `extensionMeta` and `relayRequest`, then sends `question_answer` to background.
 *    **Largely fixed** at the extension protocol level.
 *
 * ---
 *
 * ## Fixed vs unlikely to load from server
 *
 * | Area | Likely fixed in-extension | Candidate for future remote config |
 * |------|---------------------------|-------------------------------------|
 * | Receive envelope (`postMessage` + `ask_question` bridge) | Yes | Unlikely |
 * | Emit payload shape → background | Yes | Unlikely |
 * | Resolve / Fill / Submit selectors & events | No | Yes (per site) |
 * | Wait/capture (SSE parse vs DOM poll + heuristics) | No | Partially |
 */

/** Discriminator for docs / future tooling; not used at runtime yet. */
export type ProviderPhase =
  | "receive"
  | "resolve_composer"
  | "fill"
  | "submit"
  | "wait_capture"
  | "emit";

/** Bump when the semantics described above change. */
export const PROVIDER_PHASE_MODEL_VERSION = 1 as const;
