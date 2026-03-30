import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to `server/public` (next to `src` / `dist`). */
export const SERVER_PUBLIC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public"
);
