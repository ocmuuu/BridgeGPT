import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Application, Request, Response } from "express";

/** `server/src/data` in dev; `dist/data` after `tsc` (this file lives under `api/extension/`). */
const SERVER_DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data"
);

/**
 * Public contract for `GET /extension/provider-phase-config`.
 * Mirrors `extension/src/pages/content/shared/providerPhaseModel.ts` (extension
 * does not fetch this yet — safe to evolve behind `apiVersion`).
 */
export const EXTENSION_PROVIDER_PHASE_CONFIG_PATH =
  "/extension/provider-phase-config";

const PHASE_ORDER = [
  "receive",
  "resolve_composer",
  "fill",
  "submit",
  "wait_capture",
  "emit",
] as const;

type PhaseId = (typeof PHASE_ORDER)[number];

type WaitCaptureStrategy = "sse_intercept" | "dom_poll";

export type ExtensionProviderPhaseConfigBody = {
  /** Increment when the JSON shape or semantics change in a breaking way. */
  apiVersion: number;
  /** In lockstep with extension `PROVIDER_PHASE_MODEL_VERSION` when possible. */
  phaseModelVersion: number;
  /** Self URL path (same host as the relay). */
  path: string;
  phases: Array<{
    id: PhaseId;
    order: number;
    summary: string;
    /** If false, unlikely to be overridden from relay in future releases. */
    typicallyRemoteConfigurable: boolean;
  }>;
  providers: Record<
    string,
    {
      id: string;
      waitCaptureStrategy: WaitCaptureStrategy;
      /** Phases where future remote fragments (e.g. selectors) may apply. */
      remoteConfigurablePhases: PhaseId[];
      implementationNote: string;
    }
  >;
  /**
   * Declarative mirror of extension page-world behavior: postMessage identities,
   * timeouts, primary selectors, SSE/DOM strategy hints. **Not executable code**
   * (generated with `providerPhaseExecutionProfile.json`).
   */
  providerExecutionProfile?: unknown;
  /**
   * Full TypeScript sources per provider phase (large payload). Present only when
   * the client passes `?include=typescript_sources` on this endpoint.
   */
  providerStepDefaults?: unknown;
  /** Reserved for forward-compatible fields; clients should ignore unknown keys. */
  _meta?: {
    documentation: string;
  };
};

function readProviderPhaseDefaultSources(): unknown {
  try {
    const p = join(SERVER_DATA_DIR, "providerPhaseDefaultSources.json");
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

function readProviderPhaseExecutionProfile(): unknown {
  try {
    const p = join(SERVER_DATA_DIR, "providerPhaseExecutionProfile.json");
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

function wantsTypeScriptSources(req: Request): boolean {
  const raw = req.query.include;
  const tokens = new Set<string>();
  const add = (s: unknown) => {
    if (typeof s !== "string") return;
    for (const part of s.split(/[, ]+/)) {
      if (part) tokens.add(part);
    }
  };
  add(raw);
  if (Array.isArray(raw)) {
    for (const item of raw) add(item);
  }
  return tokens.has("typescript_sources");
}

function buildBody(includeTypeScriptSources: boolean): ExtensionProviderPhaseConfigBody {
  const base: ExtensionProviderPhaseConfigBody = {
    apiVersion: 2,
    phaseModelVersion: 1,
    path: EXTENSION_PROVIDER_PHASE_CONFIG_PATH,
    phases: [
      {
        id: "receive",
        order: 1,
        summary:
          "Content receives ask_question; stores relay metadata; postMessages page with text.",
        typicallyRemoteConfigurable: false,
      },
      {
        id: "resolve_composer",
        order: 2,
        summary: "Locate live composer (selectors, shadow DOM, visibility).",
        typicallyRemoteConfigurable: true,
      },
      {
        id: "fill",
        order: 3,
        summary: "Write prompt and dispatch framework input events.",
        typicallyRemoteConfigurable: true,
      },
      {
        id: "submit",
        order: 4,
        summary: "Send message (click, pointer synthesis, keyboard shortcuts).",
        typicallyRemoteConfigurable: true,
      },
      {
        id: "wait_capture",
        order: 5,
        summary:
          "Detect reply ready: SSE stream (ChatGPT) or DOM poll + stability (Gemini/Grok).",
        typicallyRemoteConfigurable: true,
      },
      {
        id: "emit",
        order: 6,
        summary:
          "postMessage to content; QuestionAnswerPayload to background.",
        typicallyRemoteConfigurable: false,
      },
    ],
    providers: {
      chatgpt: {
        id: "chatgpt",
        waitCaptureStrategy: "sse_intercept",
        remoteConfigurablePhases: [
          "resolve_composer",
          "fill",
          "submit",
          "wait_capture",
        ],
        implementationNote:
          "Page script wraps fetch; assistant text from SSE delta patches. Composer fill/submit run in page world.",
      },
      gemini: {
        id: "gemini",
        waitCaptureStrategy: "dom_poll",
        remoteConfigurablePhases: [
          "resolve_composer",
          "fill",
          "submit",
          "wait_capture",
        ],
        implementationNote:
          "Quill/rich-textarea; conversation-scoped markdown capture; assistantHtml + assistantText.",
      },
      grok: {
        id: "grok",
        waitCaptureStrategy: "dom_poll",
        remoteConfigurablePhases: [
          "resolve_composer",
          "fill",
          "submit",
          "wait_capture",
        ],
        implementationNote:
          "ProseMirror/textarea; Mod+Enter fallback; markdown nodes + preview/boilerplate heuristics.",
      },
    },
    _meta: {
      documentation:
        "Default response includes providerExecutionProfile (structured, non-code) synced from extension providers. For embedded TypeScript per phase, request GET with query include=typescript_sources. Regenerate both JSON files via `npm run gen:provider-sources` at repo root; server build copies them into dist/data.",
    },
  };
  const profile = readProviderPhaseExecutionProfile();
  if (profile !== undefined) {
    base.providerExecutionProfile = profile;
  }
  if (includeTypeScriptSources) {
    const embedded = readProviderPhaseDefaultSources();
    if (embedded !== undefined) {
      base.providerStepDefaults = embedded;
    }
  }
  return base;
}

export function registerExtensionProviderPhaseConfigRoute(
  app: Application
): void {
  app.get(
    EXTENSION_PROVIDER_PHASE_CONFIG_PATH,
    (req: Request, res: Response) => {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(buildBody(wantsTypeScriptSources(req)));
    }
  );
}
