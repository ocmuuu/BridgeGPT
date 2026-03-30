import type { Request, Response } from "express";

const LISTED_GEMINI_MODELS: Record<string, unknown>[] = [
  {
    name: "models/gemini-3.1-flash",
    version: "001",
    displayName: "Gemini 3.1 Flash",
    description:
      "Placeholder id for clients; answers use whichever model is selected on gemini.google.com.",
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
  },
  {
    name: "models/gemini-3.1-pro",
    version: "001",
    displayName: "Gemini 3.1 Pro",
    description:
      "Placeholder id for clients; answers use whichever model is selected on gemini.google.com.",
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
  },
  {
    name: "models/gemini-3.1",
    version: "001",
    displayName: "Gemini 3.1",
    description:
      "Placeholder id for clients; answers use whichever model is selected on gemini.google.com.",
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
  },
];

/** Path segment e.g. gemini-3.1-flash:generateContent */
export function parseModelsResource(resource: string): {
  model: string;
  method: "generateContent" | "streamGenerateContent";
} | null {
  const m = resource.match(/^(.+):(generateContent|streamGenerateContent)$/);
  if (!m) return null;
  return {
    model: m[1],
    method: m[2] as "generateContent" | "streamGenerateContent",
  };
}

export function modelsPath(
  version: "v1" | "v1beta",
  model: string,
  method: string
): string {
  return `/${version}/models/${model}:${method}`;
}

export function toGenerateContentResponse(args: {
  model: string;
  text: string;
  promptTokens: number;
  completionTokens: number;
  responseId: string;
}): Record<string, unknown> {
  const modelName = `models/${args.model}`;
  return {
    candidates: [
      {
        content: {
          role: "model",
          parts: [{ text: args.text }],
        },
        finishReason: "STOP",
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: args.promptTokens,
      candidatesTokenCount: args.completionTokens,
      totalTokenCount: args.promptTokens + args.completionTokens,
    },
    modelVersion: modelName,
    responseId: args.responseId,
  };
}

export function handleGeminiModelsList(_req: Request, res: Response): void {
  res.json({ models: LISTED_GEMINI_MODELS });
}

export function handleGeminiModelGet(req: Request, res: Response): void {
  const raw = req.params.modelId ?? "";
  const id = raw.startsWith("models/") ? raw.slice("models/".length) : raw;
  const fullName = `models/${id}`;
  const found = LISTED_GEMINI_MODELS.find((m) => m.name === fullName);
  if (!found) {
    res.status(404).json({
      error: {
        code: 404,
        message: `models/${id} is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.`,
        status: "NOT_FOUND",
      },
    });
    return;
  }
  res.json(found);
}
