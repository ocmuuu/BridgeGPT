import React from "react";
import { ConnectButton } from "../settings/components/connect";
import { Settings } from "lucide-react";

export default function Popup() {
  const handleEditSetting = () => {
    chrome.tabs.create({ url: "src/pages/settings/index.html" });
  };

  return (
    <div className="min-h-[280px] flex flex-col bg-gradient-to-b from-slate-100 via-white to-violet-50/50 dark:from-violet-950 dark:via-slate-900 dark:to-slate-950">
      <div className="px-4 pt-3.5 pb-2 flex items-center gap-2.5">
        <img
          src="/icon-128.png"
          alt=""
          className="w-9 h-9 rounded-lg shadow-md shadow-slate-900/10 ring-1 ring-slate-200/80 dark:shadow-lg dark:shadow-violet-950/50 dark:ring-white/10"
          width={36}
          height={36}
        />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 tracking-tight leading-tight dark:text-white">
            BridgeGPT
          </p>
          <p className="text-[11px] text-slate-600 leading-tight truncate dark:text-violet-200/80">
            Bridge Your ChatGPT Account to Your Apps
          </p>
        </div>
      </div>

      <div className="flex-1 px-3 pb-3 pt-1">
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/90 overflow-hidden dark:bg-slate-800/95 dark:shadow-xl dark:shadow-black/40 dark:ring-slate-600/80">
          <div className="p-4">
            <ConnectButton popup />
          </div>
          <div className="px-4 pb-4 flex justify-center border-t border-slate-100 pt-3 dark:border-slate-700">
            <button
              type="button"
              onClick={handleEditSetting}
              className="flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900 py-2 px-4 rounded-xl border border-violet-200/80 bg-violet-50/80 hover:bg-violet-100/90 transition-colors dark:text-violet-300 dark:hover:text-violet-200 dark:border-violet-700/80 dark:bg-violet-950/60 dark:hover:bg-violet-900/50"
            >
              <Settings size={16} strokeWidth={2} />
              <span>Open settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
