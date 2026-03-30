import type { NextFunction, Request, Response } from "express";

import { extractRoomIdFromOpenAIAuth } from "../shared/roomAuth.js";
import type { RelayRoomRequest } from "../shared/relayRoom.js";

export function requireApiKeyRoom(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
