import type {
  Application,
  NextFunction,
  Request,
  Response,
} from "express";
import { randomBytes } from "node:crypto";
import type { Server } from "socket.io";

import { pushPending } from "./extensionRelay.js";
import {
  relayChatShellHtml,
  RELAY_API_KEY_COOKIE,
} from "./relayChatWeb.js";

function randomId(): string {
  return randomBytes(12).toString("hex");
}

/** OpenAI-style system_fingerprint when no real backend fingerprint exists. */
function randomSystemFingerprint(): string {
  return `fp_${randomBytes(5).toString("hex")}`;
}

type CompletionStreamBase = {
  id: string;
  created: number;
  model: string;
  system_fingerprint: string;
};

function buildCompletionStreamBase(
  requestBody: Record<string, unknown>
): CompletionStreamBase {
  return {
    id: `chatcmpl-${randomId()}`,
    created: Math.floor(Date.now() / 1000),
    model: (requestBody.model as string | undefined) ?? "gpt-5",
    system_fingerprint: randomSystemFingerprint(),
  };
}

function splitTextForStreamChunks(text: string, maxCodePoints: number): string[] {
  if (!text) return [];
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += maxCodePoints) {
    out.push(chars.slice(i, i + maxCodePoints).join(""));
  }
  return out;
}

function writeSseData(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeSseDone(res: Response): void {
  res.write("data: [DONE]\n\n");
}

/** One chat.completion.chunk object (OpenAI SSE shape). */
function chatCompletionChunk(
  base: CompletionStreamBase,
  delta: Record<string, unknown>,
  finishReason: string | null,
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
): Record<string, unknown> {
  const chunk: Record<string, unknown> = {
    id: base.id,
    object: "chat.completion.chunk",
    created: base.created,
    model: base.model,
    system_fingerprint: base.system_fingerprint,
    choices: [
      {
        index: 0,
        delta,
        logprobs: null,
        finish_reason: finishReason,
      },
    ],
  };
  if (usage) chunk.usage = usage;
  return chunk;
}

/**
 * Simulate OpenAI streaming SSE from full text (extension sends one payload; server chunks).
 */
function sendOpenAIChatCompletionStream(
  res: Response,
  clientPayload: unknown,
  requestBody: Record<string, unknown>
): void {
  const base = buildCompletionStreamBase(requestBody);
  const content = extractAssistantContent(clientPayload);
  const usage = buildUsage(requestBody, content);

  writeSseData(res, chatCompletionChunk(base, { role: "assistant" }, null));

  const pieces = splitTextForStreamChunks(content, 16);
  for (const piece of pieces) {
    writeSseData(res, chatCompletionChunk(base, { content: piece }, null));
  }

  writeSseData(res, chatCompletionChunk(base, {}, "stop", usage));
  writeSseDone(res);
}

/**
 * Extract assistant plain text from extension payload (extra fields for debugging only).
 */
function extractAssistantContent(message: unknown): string {
  if (message === null || message === undefined) return "";
  if (typeof message === "string") return message;
  if (typeof message !== "object") return String(message);
  const o = message as Record<string, unknown>;
  for (const key of ["assistantText", "text", "content", "message"] as const) {
    const v = o[key];
    if (typeof v === "string") return v;
  }
  const choices = o.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const m = (choices[0] as { message?: { content?: unknown } }).message;
    if (m && typeof m.content === "string") return m.content;
  }
  return "";
}

function roughTokenCount(text: string): number {
  if (!text) return 0;
  let score = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    score += cp <= 0x7f ? 0.28 : 1;
  }
  return Math.max(0, Math.round(score));
}

function normalizeMessageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return String(content ?? "");
}

/**
 * Plain text for the ChatGPT composer: message bodies only (no "user:" / role prefixes).
 * ChatGPT.com already keeps thread context, so only the latest user turn is injected —
 * sending the full messages[] would duplicate the entire history in the input box.
 */
function buildPromptForChatgptWeb(route: string, body: unknown): string {
  if (
    route === "/v1/chat/completions" &&
    body &&
    typeof body === "object" &&
    "messages" in body
  ) {
    const msgs = (body as { messages?: unknown }).messages;
    if (Array.isArray(msgs) && msgs.length > 0) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m || typeof m !== "object") continue;
        const role = String((m as { role?: string }).role ?? "").toLowerCase();
        if (role !== "user") continue;
        const text = normalizeMessageContentToString(
          (m as { content?: unknown }).content
        ).trim();
        if (text) return text;
      }
      const parts: string[] = [];
      for (const m of msgs) {
        if (!m || typeof m !== "object") continue;
        const text = normalizeMessageContentToString(
          (m as { content?: unknown }).content
        ).trim();
        if (text) parts.push(text);
      }
      if (parts.length > 0) return parts.join("\n\n");
    }
  }
  return `Route: ${route}\nPayload: ${JSON.stringify(body)}`;
}

function estimatePromptTokensFromRequestBody(body: Record<string, unknown>): number {
  const msgs = body.messages;
  let total = 0;
  if (Array.isArray(msgs)) {
    for (const m of msgs) {
      if (!m || typeof m !== "object") continue;
      const role = String((m as { role?: string }).role ?? "user");
      const text = normalizeMessageContentToString(
        (m as { content?: unknown }).content
      );
      total += roughTokenCount(role) + 3;
      total += roughTokenCount(text);
    }
  }
  const rest = { ...body };
  delete rest.messages;
  delete rest.model;
  delete rest.stream;
  const extra = JSON.stringify(rest);
  if (extra.length > 2) {
    total += roughTokenCount(extra);
  }
  return total;
}

function buildUsage(
  requestBody: Record<string, unknown>,
  completionText: string
): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  const prompt_tokens = estimatePromptTokensFromRequestBody(requestBody);
  const completion_tokens = roughTokenCount(completionText);
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
  };
}

function toOpenAICompletion(
  clientPayload: unknown,
  requestBody: Record<string, unknown>
): Record<string, unknown> {
  const model = (requestBody.model as string | undefined) ?? "gpt-5";
  const content = extractAssistantContent(clientPayload);
  const usage = buildUsage(requestBody, content);
  return {
    id: `chatcmpl-${randomId()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    system_fingerprint: randomSystemFingerprint(),
    service_tier: "default",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage,
  };
}

/** Display names only; the web session chooses the real model. */
const LISTED_MODELS: readonly { id: string; created: number }[] = [
  { id: "gpt-5", created: 1740000000 },
  { id: "gpt-5-mini", created: 1740086400 },
];

function openaiModelObject(id: string, created: number) {
  return {
    id,
    object: "model" as const,
    created,
    owned_by: "bridgegpt",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractRoomIdFromOpenAIAuth(req: Request): string | null {
  const auth = req.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length > 0) return t;
  }
  const headerKey =
    req.get("x-api-key") ?? req.get("openai-api-key") ?? req.get("api-key");
  if (headerKey?.trim()) return headerKey.trim();
  return null;
}

type RelayRoomRequest = Request & { relayRoom?: string };

/** OpenAI-style body for HTTP 503 when no extension socket is in this api_key room. */
const EXTENSION_OFFLINE_MESSAGE =
  "BridgeGPT Chrome extension is not connected for this api_key on this relay. " +
  "Open the extension → Settings: confirm relay server URL, click Connect, and keep a signed-in https://chatgpt.com tab open. " +
  "If you regenerated api_key, update your OpenAI client. Check the extension icon and Settings for connection status.";

function extensionOfflineOpenAIError(): Record<string, unknown> {
  return {
    error: {
      message: EXTENSION_OFFLINE_MESSAGE,
      type: "server_error",
      param: null,
      code: "service_unavailable",
    },
  };
}

function relayLogApiKeyHint(roomId: string): string {
  if (roomId.length <= 24) return roomId;
  return `${roomId.slice(0, 14)}…(len=${roomId.length})`;
}

async function assertExtensionOnline(
  io: Server,
  roomId: string,
  res: Response
): Promise<boolean> {
  const sockets = await io.in(roomId).fetchSockets();
  if (sockets.length === 0) {
    console.warn(
      `[relay] No Socket.IO client in room for api_key=${relayLogApiKeyHint(roomId)}. ` +
        "Extension must call GET /connect/:api_key?socketId= after WebSocket connects."
    );
    res.status(503).json(extensionOfflineOpenAIError());
    return false;
  }
  console.log(
    `[relay] Routing request to extension (sockets in room=${sockets.length}, api_key=${relayLogApiKeyHint(roomId)})`
  );
  return true;
}

function requireApiKeyRoom(req: Request, res: Response, next: NextFunction) {
  const roomId = extractRoomIdFromOpenAIAuth(req);
  if (!roomId) {
    res.status(401).json({
      error: {
        message:
          "Missing credentials. Set OpenAI client api_key to the secret from BridgeGPT extension settings (sent as Bearer token or x-api-key).",
        type: "invalid_request_error",
        param: null,
        code: "invalid_api_key",
      },
    });
    return;
  }
  (req as RelayRoomRequest).relayRoom = roomId;
  next();
}

function handleModelsList(_req: Request, res: Response) {
  res.json({
    object: "list",
    data: LISTED_MODELS.map((m) => openaiModelObject(m.id, m.created)),
  });
}

function handleModelRetrieve(req: Request, res: Response) {
  const found = LISTED_MODELS.find((m) => m.id === req.params.modelId);
  if (!found) {
    res.status(404).json({
      error: {
        message: `The model '${req.params.modelId}' does not exist`,
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    });
    return;
  }
  res.json(openaiModelObject(found.id, found.created));
}

async function handleChatCompletion(
  io: Server,
  roomId: string,
  body: { stream?: boolean; model?: string; messages?: unknown },
  res: Response
): Promise<void> {
  const record = body as Record<string, unknown>;
  const stream = body?.stream === true;

  if (!(await assertExtensionOnline(io, roomId, res))) return;

  if (stream) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
  }

  const responsePromise = pushPending(roomId);
  const route = "/v1/chat/completions";
  const payload = {
    route,
    body,
    promptForChatgpt: buildPromptForChatgptWeb(route, body),
  };
  console.log("[relay] emit serverMessage → extension (chat/completions)");
  io.to(roomId).emit("serverMessage", payload);

  try {
    const message = await responsePromise;
    if (stream) {
      sendOpenAIChatCompletionStream(res, message, record);
      res.end();
    } else {
      res.json(toOpenAICompletion(message, record));
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (stream) {
      writeSseData(res, {
        error: {
          message: err.message,
          type: "server_error",
          param: null,
          code: "request_timeout",
        },
      });
      res.end();
    } else {
      res.status(504).json({
        error: {
          message: err.message,
          type: "timeout",
          param: null,
          code: "request_timeout",
        },
      });
    }
  }
}

function roomIdFromCookie(req: Request): string | null {
  const raw = req.get("cookie");
  if (!raw) return null;
  const prefix = `${RELAY_API_KEY_COOKIE}=`;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      const v = decodeURIComponent(p.slice(prefix.length).trim());
      return v || null;
    }
  }
  return null;
}

function resolveRelayHomeRoomId(req: Request, paramRoomId?: string): string | null {
  if (paramRoomId) return paramRoomId;
  const fromAuth = extractRoomIdFromOpenAIAuth(req);
  if (fromAuth) return fromAuth;
  const q = req.query.api_key;
  if (typeof q === "string" && q.trim()) return q.trim();
  const q2 = req.query.apikey;
  if (typeof q2 === "string" && q2.trim()) return q2.trim();
  return roomIdFromCookie(req);
}

function wantsRelayHomeJson(req: Request): boolean {
  return (
    req.query.format === "json" ||
    (req.get("accept")?.includes("application/json") ?? false)
  );
}

/** Relay home: GET / — JSON status or ChatGPT-like web UI (api_key from URL/cookie in the browser). */
function handleRelayHome(req: Request, res: Response, paramRoomId?: string): void {
  const wantJson = wantsRelayHomeJson(req);
  const roomId = resolveRelayHomeRoomId(req, paramRoomId);

  const message =
    typeof req.query.message === "string" ? req.query.message.trim() : "";
  const model =
    typeof req.query.model === "string" && req.query.model
      ? req.query.model
      : "gpt-5";

  const shell = relayChatShellHtml({
    initialUserMessage: message,
    model,
  });

  if (!roomId) {
    if (wantJson) {
      res.status(401).json({
        error: {
          message:
            "Missing api_key: use ?api_key= or ?apikey=, Authorization: Bearer <roomId>, Cookie " +
            RELAY_API_KEY_COOKIE +
            " (set when opening web chat from the extension), or open GET / in a browser.",
          type: "invalid_request_error",
          param: null,
          code: "missing_credentials",
        },
      });
      return;
    }
    res.type("html").send(shell);
    return;
  }

  const base = `${req.protocol}://${req.get("host") ?? "127.0.0.1:3456"}`;
  const sampleMsg = encodeURIComponent("how to use apis");
  const chatUrl = `${base}/?api_key=${encodeURIComponent(roomId)}&message=${sampleMsg}`;

  if (wantJson) {
    res.json({
      ok: true,
      roomId,
      steps: [
        "Extension: Settings → Connect; keep chatgpt.com open.",
        "OpenAI SDK: base_url = …/v1, api_key = this roomId.",
        "Browser chat: use Settings → Open web chat once (saves cookie), or open chatUrl below.",
      ],
      chatUrl,
    });
    return;
  }

  res.type("html").send(shell);
}

/** Register OpenAI-compatible HTTP routes and relay home at GET / (requires io + extension relay queue). */
export function registerOpenAIApiRoutes(app: Application, io: Server): void {
  app.get(
    "/v1/models/:modelId",
    requireApiKeyRoom,
    async (req, res) => {
      const roomId = (req as RelayRoomRequest).relayRoom!;
      if (!(await assertExtensionOnline(io, roomId, res))) return;
      handleModelRetrieve(req, res);
    }
  );
  app.get("/v1/models", requireApiKeyRoom, async (req, res) => {
    const roomId = (req as RelayRoomRequest).relayRoom!;
    if (!(await assertExtensionOnline(io, roomId, res))) return;
    handleModelsList(req, res);
  });
  app.post("/v1/chat/completions", requireApiKeyRoom, async (req, res) => {
    const roomId = (req as RelayRoomRequest).relayRoom!;
    await handleChatCompletion(io, roomId, req.body, res);
  });

  app.get("/app/:roomId/v1/models/:modelId", async (req, res) => {
    const { roomId } = req.params;
    if (!(await assertExtensionOnline(io, roomId, res))) return;
    handleModelRetrieve(req, res);
  });
  app.get("/app/:roomId/v1/models", async (req, res) => {
    const { roomId } = req.params;
    if (!(await assertExtensionOnline(io, roomId, res))) return;
    handleModelsList(req, res);
  });
  app.post("/app/:roomId/v1/chat/completions", async (req, res) => {
    const { roomId } = req.params;
    await handleChatCompletion(io, roomId, req.body, res);
  });

  app.get("/", (req, res) => {
    handleRelayHome(req, res);
  });
}
