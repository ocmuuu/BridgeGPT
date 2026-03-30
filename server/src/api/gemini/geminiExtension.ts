import type { Response } from "express";
import type { Server } from "socket.io";

import { relayLogApiKeyHint } from "../shared/roomAuth.js";

export async function assertExtensionOnlineGemini(
  io: Server,
  roomId: string,
  res: Response
): Promise<boolean> {
  const sockets = await io.in(roomId).fetchSockets();
  if (sockets.length === 0) {
    console.warn(
      `[relay] Gemini API: no Socket.IO client in room api_key=${relayLogApiKeyHint(roomId)}`
    );
    res.status(503).json({
      error: {
        code: 503,
        message:
          "BridgeGPT extension is not connected for this API key. Connect in the extension and keep https://gemini.google.com signed in.",
        status: "UNAVAILABLE",
      },
    });
    return false;
  }
  return true;
}
