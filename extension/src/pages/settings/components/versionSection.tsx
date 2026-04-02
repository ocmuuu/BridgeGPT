import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BRIDGEGPT_GITHUB_RELEASES_URL } from "@src/config";
import { useExtensionUpdateAvailable } from "@src/hooks/useExtensionUpdateAvailable";

type VersionCheckResponse =
  | {
      ok: true;
      local: string;
      server: string;
      status: "unchanged" | "update_available";
    }
  | { ok: false; error: string };

export function VersionSection() {
  const { pending, serverVersion } = useExtensionUpdateAvailable();
  const localVersion =
    typeof chrome.runtime.getManifest().version === "string"
      ? chrome.runtime.getManifest().version
      : "?";

  const [checking, setChecking] = useState(false);
  const [manualUnchanged, setManualUnchanged] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const runCheck = () => {
    setChecking(true);
    setManualUnchanged(false);
    setManualError(null);
    chrome.runtime.sendMessage(
      { type: "check_extension_version" },
      (r: VersionCheckResponse | undefined) => {
        setChecking(false);
        void chrome.runtime.lastError;
        if (chrome.runtime.lastError) {
          setManualError(
            chrome.runtime.lastError.message ?? "Extension message failed"
          );
          return;
        }
        if (!r || typeof r !== "object" || !("ok" in r)) {
          setManualError("No response from extension");
          return;
        }
        if (!r.ok) {
          setManualError(r.error);
          return;
        }
        if (r.status === "unchanged") {
          setManualUnchanged(true);
        }
      }
    );
  };

  const recommendServer = pending && serverVersion ? serverVersion : null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-4 mb-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-base font-medium tabular-nums text-slate-900 dark:text-slate-100">
          v{localVersion}
        </span>
        <button
          type="button"
          onClick={runCheck}
          disabled={checking}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking…
            </>
          ) : (
            "Check"
          )}
        </button>
      </div>

      {manualError ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{manualError}</p>
      ) : null}

      {manualUnchanged && !recommendServer ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Version unchanged — relay does not recommend a newer build.
        </p>
      ) : null}

      {recommendServer ? (
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-100/90 leading-relaxed">
          <span className="font-medium">Update available.</span> Relay recommends{" "}
          <span className="font-mono">v{recommendServer}</span>. Install the latest
          Chrome extension from{" "}
          <a
            href={BRIDGEGPT_GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2 hover:opacity-90"
          >
            GitHub Releases
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
