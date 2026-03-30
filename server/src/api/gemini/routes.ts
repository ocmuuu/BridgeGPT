import type { Application } from "express";
import type { Server } from "socket.io";

import type { RelayRoomRequest } from "../shared/relayRoom.js";
import { requireGeminiRelayRoom } from "./geminiAuth.js";
import { handleGeminiGenerate } from "./geminiGenerate.js";
import {
  handleGeminiModelGet,
  handleGeminiModelsList,
} from "./geminiModels.js";

/**
 * Gemini Generative Language API paths under `/v1beta/…` (same as
 * `generativelanguage.googleapis.com`). We intentionally do **not** mirror
 * `/v1/…` here: this relay already uses `/v1/models` and `/v1/chat/completions`
 * for OpenAI compatibility on the same host.
 */
export function registerGeminiApiRoutes(app: Application, io: Server): void {
  app.get("/v1beta/models", requireGeminiRelayRoom, handleGeminiModelsList);
  app.get(
    "/v1beta/models/:modelId",
    requireGeminiRelayRoom,
    handleGeminiModelGet
  );
  app.post(
    "/v1beta/models/:resource",
    requireGeminiRelayRoom,
    async (req, res) => {
      const roomId = (req as RelayRoomRequest).relayRoom!;
      await handleGeminiGenerate(io, roomId, req, res, "v1beta");
    }
  );

  app.get("/app/:roomId/v1beta/models", async (req, res) => {
    const { roomId } = req.params;
    (req as RelayRoomRequest).relayRoom = roomId;
    handleGeminiModelsList(req, res);
  });
  app.get("/app/:roomId/v1beta/models/:modelId", async (req, res) => {
    const { roomId } = req.params;
    (req as RelayRoomRequest).relayRoom = roomId;
    handleGeminiModelGet(req, res);
  });
  app.post("/app/:roomId/v1beta/models/:resource", async (req, res) => {
    const { roomId } = req.params;
    await handleGeminiGenerate(io, roomId, req, res, "v1beta");
  });
}
