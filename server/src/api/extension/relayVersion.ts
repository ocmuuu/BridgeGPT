import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Application, Response } from "express";

/** Grouped with other extension discovery routes (e.g. provider-phase-config). */
export const EXTENSION_VERSION_PATH = "/extension/version";

export type ExtensionVersionResponseBody = {
  /** Semver the relay expects users to run (see `server/package.json` `extensionVersion`). */
  extension: string;
  /** `@bridgegpt/server` package semver from the same `package.json`. */
  relay: string;
};

const SERVER_PKG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "package.json"
);

function readExtensionVersionResponseBody(): ExtensionVersionResponseBody {
  const env = process.env.BRIDGEGPT_EXTENSION_VERSION?.trim();
  const pkg = JSON.parse(readFileSync(SERVER_PKG_PATH, "utf8")) as {
    extensionVersion?: string;
    version?: string;
  };
  const relay =
    typeof pkg.version === "string" ? pkg.version.trim() : "0.0.0";
  if (env) {
    return { extension: env, relay };
  }
  if (typeof pkg.extensionVersion === "string" && pkg.extensionVersion.length > 0) {
    return { extension: pkg.extensionVersion.trim(), relay };
  }
  return { extension: relay, relay };
}

/**
 * Expected extension semver for clients. Override with `BRIDGEGPT_EXTENSION_VERSION`
 * when deploying without bumping `package.json`.
 */
export function getExpectedExtensionVersion(): string {
  return readExtensionVersionResponseBody().extension;
}

function sendExtensionVersionJson(res: Response): void {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(readExtensionVersionResponseBody());
}

export function registerVersionRoute(app: Application): void {
  app.get(EXTENSION_VERSION_PATH, (_req, res) => {
    sendExtensionVersionJson(res);
  });
}
