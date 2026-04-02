import { useState } from "react";
import { Loader2, Package } from "lucide-react";
import { BRIDGEGPT_GITHUB_RELEASES_URL } from "@src/config";
import { useExtensionUpdateAvailable } from "@src/hooks/useExtensionUpdateAvailable";
import { useSettingsUi } from "@src/i18n/SettingsUiContext";

type VersionCheckResponse =
  | {
      ok: true;
      local: string;
      server: string;
      status: "unchanged" | "update_available";
    }
  | { ok: false; error: string };

export function VersionSection() {
  const { t } = useSettingsUi();
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
            chrome.runtime.lastError.message ?? t("verExtMsgFail")
          );
          return;
        }
        if (!r || typeof r !== "object" || !("ok" in r)) {
          setManualError(t("verNoResponse"));
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
  const highlight = Boolean(recommendServer);

  return (
    <section
      id="extension-version"
      aria-labelledby="extension-version-heading"
      className={`rounded-xl p-5 mb-6 shadow-sm shadow-slate-900/5 dark:shadow-black/20 ${
        highlight
          ? "border-2 border-amber-500/90 bg-amber-50/80 ring-2 ring-amber-400/50 dark:border-amber-500/70 dark:bg-amber-950/35 dark:ring-amber-600/40"
          : "border border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-900/90"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <Package
          className={
            highlight
              ? "text-amber-700 dark:text-amber-400 shrink-0"
              : "text-slate-700 dark:text-slate-300 shrink-0"
          }
          size={26}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2
            id="extension-version-heading"
            className="text-xl font-semibold text-slate-900 dark:text-slate-100"
          >
            {t("verTitle")}
          </h2>
          {highlight ? (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t("verHighlight")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5 dark:border-slate-600/80 dark:bg-slate-900/60">
        <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
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
              {t("verChecking")}
            </>
          ) : (
            t("verCheck")
          )}
        </button>
      </div>

      {manualError ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{manualError}</p>
      ) : null}

      {manualUnchanged && !recommendServer ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {t("verUnchanged")}
        </p>
      ) : null}

      {recommendServer ? (
        <p className="mt-3 text-sm text-amber-950 dark:text-amber-50/95 leading-relaxed">
          {t("verUpdateBefore", [recommendServer])}{" "}
          <a
            href={BRIDGEGPT_GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2 hover:opacity-90"
          >
            {t("verGhReleases")}
          </a>
          {t("verUpdateAfter")}
        </p>
      ) : null}
    </section>
  );
}
