import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

import {
  attachExtensionSocket,
  registerExtensionConnectRoute,
} from "./extensionRelay.js";
import { registerOpenAIApiRoutes } from "./openaiApi.js";

const PORT = Number(process.env.PORT) || 3456;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "4mb" }));

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

httpServer.listen(PORT, () => {
  console.log(`BridgeGPT relay listening on http://localhost:${PORT}`);
});
