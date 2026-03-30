import type { Request } from "express";

export function extractRoomIdFromOpenAIAuth(req: Request): string | null {
  const auth = req.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length > 0) return t;
  }
  const headerKey =
    req.get("x-api-key") ?? req.get("openai-api-key") ?? req.get("api-key");
  if (headerKey?.trim()) return headerKey.trim();
  return null;
}

export function relayLogApiKeyHint(roomId: string): string {
  if (roomId.length <= 24) return roomId;
  return `${roomId.slice(0, 14)}…(len=${roomId.length})`;
}
