import type { Response } from "express";

export function splitTextForStreamChunks(
  text: string,
  maxCodePoints: number
): string[] {
  if (!text) return [];
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += maxCodePoints) {
    out.push(chars.slice(i, i + maxCodePoints).join(""));
  }
  return out;
}

export function writeSseData(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function writeSseDone(res: Response): void {
  res.write("data: [DONE]\n\n");
}
