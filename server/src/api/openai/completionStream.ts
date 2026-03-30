import type { Response } from "express";

import { randomId, randomSystemFingerprint } from "../shared/randomId.js";
import {
  splitTextForStreamChunks,
  writeSseData,
  writeSseDone,
} from "../shared/sse.js";
import { extractAssistantContent } from "./assistantContent.js";
import { buildUsage } from "../web/chatgptWebPrompt.js";

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

/** One chat.completion.chunk object (OpenAI SSE shape). */
function chatCompletionChunk(
  base: CompletionStreamBase,
  delta: Record<string, unknown>,
  finishReason: string | null,
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }
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
export function sendOpenAIChatCompletionStream(
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
