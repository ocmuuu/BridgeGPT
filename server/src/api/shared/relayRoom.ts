import type { Request } from "express";

export type RelayRoomRequest = Request & { relayRoom?: string };
