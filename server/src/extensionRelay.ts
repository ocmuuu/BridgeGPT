import type { Application } from "express";
import type { Server } from "socket.io";

const REQUEST_TIMEOUT_MS =
  Number(process.env.RELAY_REQUEST_TIMEOUT_MS) || 120_000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const pendingQueues = new Map<string, Pending[]>();

function rejectHead(roomId: string, err: Error): void {
  const q = pendingQueues.get(roomId);
  if (!q || q.length === 0) return;
  const p = q.shift()!;
  clearTimeout(p.timeout);
  p.reject(err);
  if (q.length === 0) pendingQueues.delete(roomId);
}

export function pushPending(roomId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      rejectHead(roomId, new Error("Extension did not respond in time"));
    }, REQUEST_TIMEOUT_MS);
    const pending: Pending = { resolve, reject, timeout };
    const q = pendingQueues.get(roomId) ?? [];
    q.push(pending);
    pendingQueues.set(roomId, q);
  });
}

export function resolveNext(roomId: string, message: unknown): void {
  const q = pendingQueues.get(roomId);
  if (!q || q.length === 0) return;
  const p = q.shift()!;
  clearTimeout(p.timeout);
  p.resolve(message);
  if (q.length === 0) pendingQueues.delete(roomId);
}

/** Wire extension WebSocket events to the pending HTTP response queue. */
export function attachExtensionSocket(io: Server): void {
  io.on("connection", (socket) => {
    socket.on(
      "clientResponse",
      (data: { roomId?: string; message?: unknown }) => {
        const roomId = data?.roomId;
        if (!roomId || typeof roomId !== "string") return;
        resolveNext(roomId, data.message);
      }
    );
  });
}

/** HTTP: extension joins roomId with socketId so it matches the OpenAI client room. */
export function registerExtensionConnectRoute(
  app: Application,
  io: Server
): void {
  app.get("/connect/:roomId", (req, res) => {
    let roomId: string;
    try {
      roomId = decodeURIComponent(req.params.roomId);
    } catch {
      roomId = req.params.roomId;
    }
    const socketId = req.query.socketId;
    if (!socketId || typeof socketId !== "string") {
      res.status(400).send("socketId query required");
      return;
    }
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      console.warn(
        `[relay] /connect: socket not found socketId=${socketId.slice(0, 12)}… (race or wrong server?)`
      );
      res.status(404).send("socket not found");
      return;
    }
    void socket.join(roomId);
    console.log(
      `[relay] /connect ok socket joined room api_key=${roomId.length > 24 ? `${roomId.slice(0, 14)}…` : roomId}`
    );
    res.send("ok");
  });
}
