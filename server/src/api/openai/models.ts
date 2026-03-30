import type { Request, Response } from "express";

/** Display names only; the web session chooses the real model. */
const LISTED_MODELS: readonly { id: string; created: number }[] = [
  { id: "gpt-5", created: 1740000000 },
  { id: "gpt-5-mini", created: 1740086400 },
];

function openaiModelObject(id: string, created: number) {
  return {
    id,
    object: "model" as const,
    created,
    owned_by: "bridgegpt",
  };
}

export function handleModelsList(_req: Request, res: Response): void {
  res.json({
    object: "list",
    data: LISTED_MODELS.map((m) => openaiModelObject(m.id, m.created)),
  });
}

export function handleModelRetrieve(req: Request, res: Response): void {
  const found = LISTED_MODELS.find((m) => m.id === req.params.modelId);
  if (!found) {
    res.status(404).json({
      error: {
        message: `The model '${req.params.modelId}' does not exist`,
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    });
    return;
  }
  res.json(openaiModelObject(found.id, found.created));
}
