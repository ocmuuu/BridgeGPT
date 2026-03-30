import type { Response } from "express";
import type { Server } from "socket.io";

import { openAiStyleExtensionOfflineJson } from "../shared/extensionOfflineBody.js";
import { relayLogApiKeyHint } from "../shared/roomAuth.js";

export async function assertExtensionOnline(
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
    res.status(503).json(openAiStyleExtensionOfflineJson());
    return false;
  }
  console.log(
    `[relay] Routing request to extension (sockets in room=${sockets.length}, api_key=${relayLogApiKeyHint(roomId)})`
  );
  return true;
}
