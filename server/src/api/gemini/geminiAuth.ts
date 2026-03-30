import type { NextFunction, Request, Response } from "express";

import { extractRoomIdFromOpenAIAuth } from "../shared/roomAuth.js";
import type { RelayRoomRequest } from "../shared/relayRoom.js";

/** Google clients often use ?key= or x-goog-api-key; BridgeGPT also accepts Bearer / x-api-key. */
function extractGeminiOrBridgeRoomId(req: Request): string | null {
  const q = req.query.key;
  if (typeof q === "string" && q.trim()) return q.trim();
  const goog = req.get("x-goog-api-key");
  if (goog?.trim()) return goog.trim();
  return extractRoomIdFromOpenAIAuth(req);
}

export function requireGeminiRelayRoom(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const roomId = extractGeminiOrBridgeRoomId(req);
  if (!roomId) {
    res.status(401).json({
      error: {
        code: 401,
        message:
          "API key missing: pass ?key=, x-goog-api-key, Authorization: Bearer, x-api-key, or openai-style api_key (BridgeGPT extension secret).",
        status: "UNAUTHENTICATED",
      },
    });
    return;
  }
  (req as RelayRoomRequest).relayRoom = roomId;
  next();
}
