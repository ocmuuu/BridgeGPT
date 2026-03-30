import type { Response } from "express";
import type { Server } from "socket.io";

import { relayLogApiKeyHint } from "../shared/roomAuth.js";

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
    res.status(503).json(extensionOfflineOpenAIError());
    return false;
  }
  console.log(
    `[relay] Routing request to extension (sockets in room=${sockets.length}, api_key=${relayLogApiKeyHint(roomId)})`
  );
  return true;
}
