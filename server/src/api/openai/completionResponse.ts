import { randomId, randomSystemFingerprint } from "../shared/randomId.js";
import { stripGrokThinkingPreamble } from "../web/grokThinkingPreamble.js";
import { buildUsage } from "../web/chatgptWebPrompt.js";
import { extractAssistantContent } from "./assistantContent.js";

export function toOpenAICompletion(
  clientPayload: unknown,
  requestBody: Record<string, unknown>,
  webProvider: "chatgpt" | "gemini" | "grok" = "chatgpt"
): Record<string, unknown> {
  const model = (requestBody.model as string | undefined) ?? "gpt-5";
  let content = extractAssistantContent(clientPayload);
  if (webProvider === "grok") {
    content = stripGrokThinkingPreamble(content);
  }
  const usage = buildUsage(requestBody, content);
  return {
    id: `chatcmpl-${randomId()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    system_fingerprint: randomSystemFingerprint(),
    service_tier: "default",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage,
  };
}
