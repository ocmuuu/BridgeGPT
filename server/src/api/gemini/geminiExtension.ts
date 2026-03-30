import type { Response } from "express";
import type { Server } from "socket.io";

import { EXTENSION_OFFLINE_MESSAGE } from "../shared/extensionOfflineBody.js";
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
        message: EXTENSION_OFFLINE_MESSAGE,
        status: "UNAVAILABLE",
      },
    });
    return false;
  }
  return true;
}
