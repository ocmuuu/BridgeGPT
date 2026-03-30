import type { Application } from "express";
import type { Server } from "socket.io";

import { handleRelayHome } from "../../web/relayHome.js";
import type { RelayRoomRequest } from "../shared/relayRoom.js";
import { handleChatCompletion } from "./chatCompletions.js";
import { assertExtensionOnline } from "./extensionOnline.js";
import { handleModelRetrieve, handleModelsList } from "./models.js";
import { requireApiKeyRoom } from "./middleware.js";

/** Register OpenAI-compatible HTTP routes and relay home at GET / (requires io + extension relay queue). */
export function registerOpenAIApiRoutes(app: Application, io: Server): void {
  app.get(
    "/v1/models/:modelId",
    requireApiKeyRoom,
    async (req, res) => {
      const roomId = (req as RelayRoomRequest).relayRoom!;
      if (!(await assertExtensionOnline(io, roomId, res))) return;
      handleModelRetrieve(req, res);
    }
  );
  app.get("/v1/models", requireApiKeyRoom, async (req, res) => {
    const roomId = (req as RelayRoomRequest).relayRoom!;
    if (!(await assertExtensionOnline(io, roomId, res))) return;
    handleModelsList(req, res);
  });
  app.post("/v1/chat/completions", requireApiKeyRoom, async (req, res) => {
    const roomId = (req as RelayRoomRequest).relayRoom!;
    await handleChatCompletion(io, roomId, req.body, res, req);
  });

  app.get("/app/:roomId/v1/models/:modelId", async (req, res) => {
    const { roomId } = req.params;
    if (!(await assertExtensionOnline(io, roomId, res))) return;
    handleModelRetrieve(req, res);
  });
  app.get("/app/:roomId/v1/models", async (req, res) => {
    const { roomId } = req.params;
    if (!(await assertExtensionOnline(io, roomId, res))) return;
    handleModelsList(req, res);
  });
  app.post("/app/:roomId/v1/chat/completions", async (req, res) => {
    const { roomId } = req.params;
    await handleChatCompletion(io, roomId, req.body, res, req);
  });

  app.get("/", (req, res) => {
    handleRelayHome(req, res);
  });
}
