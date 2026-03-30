import type { Request, Response } from "express";
import type { Server } from "socket.io";

import { pushPending } from "../../socket/extensionRelay.js";
import { extractAssistantContent } from "../openai/assistantContent.js";
import { randomId } from "../shared/randomId.js";
import {
  splitTextForStreamChunks,
  writeSseData,
} from "../shared/sse.js";
import { roughTokenCount } from "../shared/tokens.js";
import {
  buildPromptForGeminiWeb,
  estimateGeminiPromptTokens,
} from "./geminiBodyText.js";
import { assertExtensionOnlineGemini } from "./geminiExtension.js";
import {
  modelsPath,
  parseModelsResource,
  toGenerateContentResponse,
} from "./geminiModels.js";

export async function handleGeminiGenerate(
  io: Server,
  roomId: string,
  req: Request,
  res: Response,
  version: "v1" | "v1beta"
): Promise<void> {
  const parsed = parseModelsResource(req.params.resource ?? "");
  if (!parsed) {
    res.status(404).json({
      error: {
        code: 404,
        message: `Invalid name: ${req.params.resource ?? ""}`,
        status: "NOT_FOUND",
      },
    });
    return;
  }

  const stream = parsed.method === "streamGenerateContent";

  const body = (req.body ?? {}) as Record<string, unknown>;
  const route = modelsPath(version, parsed.model, parsed.method);

  if (!(await assertExtensionOnlineGemini(io, roomId, res))) return;

  if (stream) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
  }

  const responsePromise = pushPending(roomId);
  const promptForChatgpt = buildPromptForGeminiWeb(body);
  const payload = {
    route,
    body,
    promptForChatgpt,
    provider: "gemini" as const,
  };
  console.log("[relay] emit serverMessage → extension (Gemini API)", route);
  io.to(roomId).emit("serverMessage", payload);

  const responseId = `R-${randomId()}`;
  const promptTokens = estimateGeminiPromptTokens(body);

  try {
    const message = await responsePromise;
    const text = extractAssistantContent(message);
    const completionTokens = roughTokenCount(text);

    if (stream) {
      const pieces = splitTextForStreamChunks(text, 24);
      const modelVersion = `models/${parsed.model}`;
      if (pieces.length === 0) {
        writeSseData(res, {
          candidates: [
            {
              content: { role: "model", parts: [{ text: "" }] },
              finishReason: "STOP",
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: promptTokens,
            candidatesTokenCount: 0,
            totalTokenCount: promptTokens,
          },
          modelVersion,
          responseId,
        });
      } else {
        for (let i = 0; i < pieces.length; i++) {
          const last = i === pieces.length - 1;
          writeSseData(res, {
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: pieces[i] }],
                },
                ...(last ? { finishReason: "STOP" as const } : {}),
                index: 0,
              },
            ],
            ...(last
              ? {
                  usageMetadata: {
                    promptTokenCount: promptTokens,
                    candidatesTokenCount: completionTokens,
                    totalTokenCount: promptTokens + completionTokens,
                  },
                  modelVersion,
                  responseId,
                }
              : {}),
          });
        }
      }
      res.end();
    } else {
      res.json(
        toGenerateContentResponse({
          model: parsed.model,
          text,
          promptTokens,
          completionTokens,
          responseId,
        })
      );
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (stream) {
      writeSseData(res, {
        error: {
          code: 504,
          message: err.message,
          status: "DEADLINE_EXCEEDED",
        },
      });
      res.end();
    } else {
      res.status(504).json({
        error: {
          code: 504,
          message: err.message,
          status: "DEADLINE_EXCEEDED",
        },
      });
    }
  }
}
