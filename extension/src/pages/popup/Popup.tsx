import React from "react";
import { ConnectButton } from "../settings/components/connect";
import { Settings } from "lucide-react";

export default function Popup() {
  const handleEditSetting = () => {
    chrome.tabs.create({ url: "src/pages/settings/index.html" });
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
            Bridge Your ChatGPT Account to Your Apps
          </p>
        </div>
      </div>

      <div className="px-3 pb-5 pt-0">
        <ConnectButton popup />
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleEditSetting}
            className="flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900 py-1.5 px-3 rounded-lg border border-violet-200/80 bg-violet-50/80 hover:bg-violet-100/90 transition-colors dark:text-violet-300 dark:hover:text-violet-200 dark:border-violet-700/80 dark:bg-violet-950/60 dark:hover:bg-violet-900/50"
          >
            <Settings size={16} strokeWidth={2} />
            <span>Open settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
