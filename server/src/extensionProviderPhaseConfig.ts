import type { Application, Request, Response } from "express";

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
  /** Reserved for forward-compatible fields; clients should ignore unknown keys. */
  _meta?: {
    documentation: string;
  };
};

function buildBody(): ExtensionProviderPhaseConfigBody {
  return {
    apiVersion: 1,
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
        "Future releases may add providers.*.config (selectors, timeouts, rules). Clients that only need discovery should read apiVersion, phaseModelVersion, and providers.*.waitCaptureStrategy.",
    },
  };
}

export function registerExtensionProviderPhaseConfigRoute(
  app: Application
): void {
  app.get(
    EXTENSION_PROVIDER_PHASE_CONFIG_PATH,
    (_req: Request, res: Response) => {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(buildBody());
    }
  );
}
