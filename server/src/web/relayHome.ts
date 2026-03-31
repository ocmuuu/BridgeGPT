import type { Request, Response } from "express";

import { extractRoomIdFromOpenAIAuth } from "../api/shared/roomAuth.js";
import {
  RELAY_API_KEY_COOKIE,
  relayChatShellHtml,
} from "./relayChatShell.js";

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

function resolveRelayHomeRoomId(
  req: Request,
  paramRoomId?: string
): string | null {
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
export function handleRelayHome(
  req: Request,
  res: Response,
  paramRoomId?: string
): void {
  const wantJson = wantsRelayHomeJson(req);
  const roomId = resolveRelayHomeRoomId(req, paramRoomId);

  const message =
    typeof req.query.message === "string" ? req.query.message.trim() : "";
  const model =
    typeof req.query.model === "string" && req.query.model
      ? req.query.model
      : "gpt-5";
  const backendRaw =
    typeof req.query.backend === "string"
      ? req.query.backend.trim().toLowerCase()
      : typeof req.query.provider === "string"
        ? req.query.provider.trim().toLowerCase()
        : "";
  const backend: "openai" | "gemini" | "grok" =
    backendRaw === "gemini"
      ? "gemini"
      : backendRaw === "grok"
        ? "grok"
        : "openai";
  const geminiModel =
    typeof req.query.gemini_model === "string" && req.query.gemini_model.trim()
      ? req.query.gemini_model.trim()
      : "gemini-3.1-flash";
  const grokModel =
    typeof req.query.grok_model === "string" && req.query.grok_model.trim()
      ? req.query.grok_model.trim()
      : "grok-3";

  const shell = relayChatShellHtml({
    initialUserMessage: message,
    model,
    backend,
    geminiModel,
    grokModel,
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
        "Extension: Settings → Connect; keep chatgpt.com, gemini.google.com, and/or grok.com open as needed.",
        "OpenAI SDK: base_url = …/v1, api_key = this roomId; optional header X-Bridge-Provider: gemini|grok.",
        "Gemini API: same host, paths under /v1beta/models/… (see repo docs).",
        "Browser chat: Settings → Open web chat, or open chatUrl; add ?backend=gemini or ?backend=grok.",
      ],
      chatUrl,
    });
    return;
  }

  res.type("html").send(shell);
}
