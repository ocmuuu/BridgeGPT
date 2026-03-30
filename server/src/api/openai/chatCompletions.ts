import type { Request, Response } from "express";
import type { Server } from "socket.io";

import { pushPending } from "../../socket/extensionRelay.js";
import { writeSseData } from "../shared/sse.js";
import { assertExtensionOnline } from "./extensionOnline.js";
import { buildPromptForChatgptWeb } from "./messagePrompt.js";
import { bridgeWebProviderFromRequest } from "./providerHeader.js";
import { sendOpenAIChatCompletionStream } from "./completionStream.js";
import { toOpenAICompletion } from "./completionResponse.js";

export async function handleChatCompletion(
  io: Server,
  roomId: string,
  body: { stream?: boolean; model?: string; messages?: unknown },
  res: Response,
  req: Request
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
  const provider = bridgeWebProviderFromRequest(req);
  const payload = {
    route,
    body,
    promptForChatgpt: buildPromptForChatgptWeb(route, body),
    provider,
  };
  console.log(
    "[relay] emit serverMessage → extension (chat/completions) provider=",
    provider
  );
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
