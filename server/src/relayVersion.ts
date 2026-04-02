import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Application } from "express";

/**
 * Expected extension semver for clients. Override with env when deploying without
 * bumping package.json (e.g. hotfix relay only).
 */
export function getExpectedExtensionVersion(): string {
  const env = process.env.BRIDGEGPT_EXTENSION_VERSION?.trim();
  if (env) return env;
  const pkgPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json"
  );
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    extensionVersion?: string;
    version?: string;
  };
  if (typeof pkg.extensionVersion === "string" && pkg.extensionVersion.length > 0) {
    return pkg.extensionVersion.trim();
  }
  return typeof pkg.version === "string" ? pkg.version.trim() : "0.0.0";
}

export function registerVersionRoute(app: Application): void {
  app.get("/version", (_req, res) => {
    res.json({
      extension: getExpectedExtensionVersion(),
    });
  });
}
