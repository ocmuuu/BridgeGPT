import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { registerGeminiApiRoutes } from "./api/gemini/routes.js";
import { registerOpenAIApiRoutes } from "./api/openai/routes.js";
import {
  attachExtensionSocket,
  registerExtensionConnectRoute,
} from "./socket/extensionRelay.js";
import { SERVER_PUBLIC_DIR } from "./serverPublicPath.js";

const PORT = Number(process.env.PORT) || 3456;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "4mb" }));
app.use("/public", express.static(SERVER_PUBLIC_DIR, { index: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  transports: ["websocket"],
  cors: { origin: true },
});

attachExtensionSocket(io);
registerExtensionConnectRoute(app, io);
registerOpenAIApiRoutes(app, io);
registerGeminiApiRoutes(app, io);

httpServer.listen(PORT, () => {
  console.log(`BridgeGPT relay listening on http://localhost:${PORT}`);
});
