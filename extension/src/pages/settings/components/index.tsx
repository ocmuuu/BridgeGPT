import { useEffect, useState } from "react";
import {
  Server,
  Code,
  Info,
  ArrowRightLeft,
  Chrome,
  Link2,
} from "lucide-react";
import { ApiKeySection } from "./apiKey";
import { ApiUrlSection } from "./apiUrl";
import { ConnectButton } from "./connect";
import { RelayServerSection } from "./relayServer";

export const SettingPage = () => {
  const [keepLongConnection, setKeepLongConnection] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("keepLongConnection", (r) => {
      if (chrome.runtime.lastError) return;
      setKeepLongConnection(r.keepLongConnection === true);
    });
  }, []);

  const onKeepLongChange = (checked: boolean) => {
    setKeepLongConnection(checked);
    chrome.storage.local.set({ keepLongConnection: checked });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-violet-50/40 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-end gap-3 mb-2">
            <img
              src="/icon-128.png"
              alt="BridgeGPT"
              width={128}
              height={128}
              className="w-16 h-16"
            />
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight dark:text-slate-100">
              BridgeGPT
            </h1>
          </div>
          <div className="flex justify-between">
            <p className="text-slate-600 dark:text-slate-400">
              Bridge Your ChatGPT Account to Your Apps
            </p>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://github.com/ocmuuu/BridgeGPT"
              title="BridgeGPT on GitHub"
              className="text-slate-900 dark:text-slate-200 hover:opacity-80 transition-opacity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="30px"
                height="30px"
                viewBox="0 0 20 20"
                version="1.1"
                className="block"
              >
                <title>github [#142]</title>
                <desc>Created with Sketch.</desc>
                <defs></defs>
                <g
                  id="Page-1"
                  stroke="none"
                  stroke-width="1"
                  fill="none"
                  fill-rule="evenodd"
                >
                  <g
                    id="Dribbble-Light-Preview"
                    transform="translate(-140.000000, -7559.000000)"
                    fill="currentColor"
                  >
                    <g id="icons" transform="translate(56.000000, 160.000000)">
                      <path
                        d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399"
                        id="github-[#142]"
                      ></path>
                    </g>
                  </g>
                </g>
              </svg>
            </a>
          </div>
        </div>

        <div className="mb-6">
          <ConnectButton />
        </div>

        <RelayServerSection />

        <ApiKeySection />

        <div className="bg-white border border-slate-200/90 rounded-xl p-6 mb-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
          <div className="flex items-center gap-3 mb-4">
            <Link2 className="text-slate-700 dark:text-slate-300" size={24} />
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Connection options
            </h2>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={keepLongConnection}
              onChange={(e) => onKeepLongChange(e.target.checked)}
              className="mt-1 size-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="font-medium text-slate-900 dark:text-slate-100">Keep alive</span>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                When enabled, the setting is stored locally and every 30 seconds
                the extension checks the relay WebSocket. If disconnected, it
                tries to reconnect (alarms can wake the MV3 service worker; you
                do not need to keep the settings tab open).
              </p>
            </div>
          </label>
        </div>

        {/* How It Works Section */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 mb-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
          <div className="flex items-start gap-3 mb-4">
            <Info className="text-violet-600 dark:text-violet-400 flex-shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                How BridgeGPT Works
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                BridgeGPT acts as a middleware between your ChatGPT account and
                your client applications. Here's the flow:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center dark:bg-slate-800/80 dark:border-slate-600">
              <Code className="text-slate-700 dark:text-slate-300 mx-auto mb-2" size={28} />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Your Client App
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Using library</p>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRightLeft className="text-slate-400 dark:text-slate-500" size={20} />
            </div>
            <div className="bg-violet-50/80 border border-violet-200/60 rounded-xl p-4 text-center ring-1 ring-violet-100/50 dark:bg-violet-950/40 dark:border-violet-800/60 dark:ring-violet-900/40">
              <Server className="text-violet-700 dark:text-violet-300 mx-auto mb-2" size={28} />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Relay server
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Middleware</p>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRightLeft className="text-slate-400 dark:text-slate-500" size={20} />
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center dark:bg-slate-800/80 dark:border-slate-600">
              <Chrome className="text-green-600 dark:text-green-400 mx-auto mb-2" size={28} />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Chrome Extension
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">On your computer</p>
            </div>
          </div>

          <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-600">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Step 1:</span> Pass
              BridgeGPT relay base URL to your library →
              <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">Step 2:</span>{" "}
              Request reaches our server →
              <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">Step 3:</span>{" "}
              Server sends command to Chrome extension →
              <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">Step 4:</span>{" "}
              Extension forwards to your ChatGPT account →
              <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">Step 5:</span>{" "}
              Response travels back through the same chain
            </p>
          </div>
        </div>
        <ApiUrlSection />

        <p className="text-center mt-8 text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-4xl mx-auto text-pretty">
          If you work with sensitive content, consider{" "}
          <span className="text-slate-700 dark:text-slate-300">self-hosting the relay</span> so
          traffic stays on infrastructure you control.
        </p>
      </div>
    </div>
  );
};
