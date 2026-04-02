import React from "react";
import { ConnectButton } from "../settings/components/connect";
import { useExtensionUpdateAvailable } from "@src/hooks/useExtensionUpdateAvailable";
import { useSettingsUi } from "@src/i18n/SettingsUiContext";
import { Settings } from "lucide-react";

export default function Popup() {
  const { t } = useSettingsUi();
  const { pending } = useExtensionUpdateAvailable();

  const handleEditSetting = () => {
    const path =
      pending === true
        ? "src/pages/settings/index.html#extension-version"
        : "src/pages/settings/index.html";
    chrome.tabs.create({ url: path });
  };

  return (
    <div className="flex flex-col bg-gradient-to-b from-slate-100 via-white to-violet-50/50 dark:from-violet-950 dark:via-slate-900 dark:to-slate-950">
      <div className="px-4 pt-1.5 pb-0.5">
        <div className="mb-2">
          <div className="flex items-end gap-2 mb-1">
            <img
              src="/icon-128.png"
              alt="BridgeGPT"
              width={128}
              height={128}
              className="w-11 h-11"
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none dark:text-slate-100">
              BridgeGPT
            </h1>
          </div>
          <p className="text-xs text-slate-600 leading-snug dark:text-slate-400">
            {t("popupTagline")}
          </p>
        </div>
      </div>

      <div className="px-3 pb-5 pt-0">
        <ConnectButton popup />
        <div className="flex justify-center pt-2">
          <div className="relative inline-flex">
            <button
              type="button"
              onClick={handleEditSetting}
              aria-describedby={
                pending ? "popup-settings-update-hint" : undefined
              }
              className="flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900 py-1.5 px-3 rounded-lg border border-violet-200/80 bg-violet-50/80 hover:bg-violet-100/90 transition-colors dark:text-violet-300 dark:hover:text-violet-200 dark:border-violet-700/80 dark:bg-violet-950/60 dark:hover:bg-violet-900/50"
            >
              <Settings size={16} strokeWidth={2} />
              <span>{t("popupOpenSettings")}</span>
            </button>
            {pending ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5"
                aria-hidden
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative m-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-950" />
              </span>
            ) : null}
          </div>
        </div>
        {pending ? (
          <p
            id="popup-settings-update-hint"
            className="mx-auto mt-2 max-w-[14.5rem] text-center text-[11px] leading-snug text-amber-900/95 dark:text-amber-200/90"
          >
            {t("popupUpdateHint")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
