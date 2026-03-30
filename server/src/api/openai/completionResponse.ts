import { randomId, randomSystemFingerprint } from "../shared/randomId.js";
import { extractAssistantContent } from "./assistantContent.js";
import { buildUsage } from "./messagePrompt.js";

export function toOpenAICompletion(
  clientPayload: unknown,
  requestBody: Record<string, unknown>
): Record<string, unknown> {
  const model = (requestBody.model as string | undefined) ?? "gpt-5";
  const content = extractAssistantContent(clientPayload);
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
