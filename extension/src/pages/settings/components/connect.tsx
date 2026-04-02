import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2, Check, Server, Zap } from "lucide-react";
import clsx from "clsx";
import { useSettingsUi } from "@src/i18n/SettingsUiContext";

export const ConnectButton = ({ popup }: { popup?: boolean }) => {
  const { t } = useSettingsUi();
  const [status, setStatus] = useState("disconnected"); // disconnected, pending, connected
  const [errorMessage, setErrorMessage] = useState("");
  const [networkSpeed, setNetworkSpeed] = useState({
    downlink: 0,
    effectiveType: "unknown",
  });
  const [serverName, setServerName] = useState("");

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "get_connect_url" }, () => {
      void chrome.runtime.lastError;
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "get_connection_status" }, () => {
      void chrome.runtime.lastError;
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "get_connection_status" && msg.content) {
        setStatus(msg.content.status);
        setErrorMessage(msg.content.errorMessage);
      } else if (msg.type === "set_openai_config") {
        const url = (msg.content as { v1BaseUrl?: string }).v1BaseUrl;
        if (url) setServerName(new URL(url).hostname);
      }
    });
  }, []);

  useEffect(() => {
    // Get network information if available
    const connection: any =
      "connection" in navigator
        ? navigator.connection
        : "mozConnection" in navigator
        ? navigator.mozConnection
        : "webkitConnection" in navigator
        ? navigator.webkitConnection
        : null;

    const updateNetworkInfo = () => {
      if ("connection" in navigator) {
        if (connection) {
          setNetworkSpeed({
            downlink: connection.downlink || 0,
            effectiveType: connection.effectiveType || "unknown",
          });
        }
      }
    };

    updateNetworkInfo();

    // Listen for network changes
    if (connection) {
      connection.addEventListener("change", updateNetworkInfo);
      return () => connection.removeEventListener("change", updateNetworkInfo);
    }
  }, []);

  const formatSpeed = (mbps: number) => {
    if (mbps === 0) return t("fmtCalculating");
    if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
    return `${(mbps * 1000).toFixed(0)} Kbps`;
  };

  const getSpeedColor = (effectiveType: string) => {
    switch (effectiveType) {
      case "4g":
        return "text-green-600";
      case "3g":
        return "text-yellow-600";
      case "2g":
        return "text-orange-600";
      case "slow-2g":
        return "text-red-600";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const getSpeedBgColor = (effectiveType: string) => {
    switch (effectiveType) {
      case "4g":
        return "bg-green-100";
      case "3g":
        return "bg-yellow-100";
      case "2g":
        return "bg-orange-100";
      case "slow-2g":
        return "bg-red-100";
      default:
        return "bg-slate-100 dark:bg-slate-800";
    }
  };

  const handleConnect = () => {
    if (status !== "connected") {
      chrome.runtime.sendMessage({ type: "connect" }, () => {
        void chrome.runtime.lastError;
      });
    } else {
      chrome.runtime.sendMessage({ type: "disconnect" }, () => {
        void chrome.runtime.lastError;
      });
    }
  };

  return (
    <div>
      <div
        className={clsx({
          "bg-white border border-slate-200/90 shadow-sm shadow-slate-900/5 rounded-xl p-6 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20":
            !popup,
          "bg-transparent p-0": popup,
        })}
      >
        <div
          className={clsx("flex items-center", {
            "gap-6": !popup,
            "gap-3": popup,
            "flex-col": popup,
            "text-center": popup,
          })}
        >
          {/* Status Indicator */}
          <div className="flex-shrink-0">
            <div
              className={clsx(
                "rounded-full flex items-center justify-center transition-all duration-500",
                popup ? "w-12 h-12 border-[3px]" : "w-16 h-16 border-4",
                status === "connected"
                  ? "bg-green-100 border-green-500 animate-pulse dark:bg-green-950/50 dark:border-green-500"
                  : status === "pending"
                  ? "bg-violet-100 border-violet-500 dark:bg-violet-950/50 dark:border-violet-400"
                  : "bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600"
              )}
            >
              {status === "connected" && (
                <Check
                  className="text-green-600"
                  size={popup ? 22 : 32}
                  strokeWidth={3}
                />
              )}
              {status === "pending" && (
                <Loader2
                  className="text-violet-600 animate-spin"
                  size={popup ? 22 : 32}
                />
              )}
              {status === "disconnected" && (
                <WifiOff
                  className="text-slate-400 dark:text-slate-500"
                  size={popup ? 22 : 32}
                />
              )}
            </div>
          </div>

          {/* Status Info */}
          <div className="flex-1">
            <h2
              className={clsx(
                "font-semibold transition-colors",
                popup ? "text-base mb-0.5" : "text-xl mb-1",
                status === "connected"
                  ? "text-green-600 dark:text-green-400"
                  : status === "pending"
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-slate-900 dark:text-slate-100"
              )}
            >
              {status === "connected" && t("statusConn")}
              {status === "pending" && t("statusConnecting")}
              {status === "disconnected" && t("statusDisc")}
            </h2>
            <p
              className={clsx(
                "text-slate-600 dark:text-slate-400",
                popup ? "text-xs leading-snug" : "text-sm"
              )}
            >
              {status === "connected" && t("descConn")}
              {status === "pending" && t("descConnecting")}
              {status === "disconnected" && t("descDisc")}
            </p>
            {errorMessage && (
              <p className="text-red-600 text-sm">{errorMessage}</p>
            )}
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={status === "pending"}
            className={clsx(
              "flex-shrink-0 flex items-center gap-2 font-semibold rounded-lg transition-all duration-300",
              popup ? "py-2 px-4 text-sm" : "py-3 px-6",
              status === "connected"
                ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                : status === "pending"
                ? "bg-violet-600 text-white cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 text-white hover:shadow-lg shadow-violet-600/25"
            )}
          >
            {status === "connected" && (
              <>
                <Wifi size={popup ? 16 : 18} />
                <span>{t("btnDisconnect")}</span>
              </>
            )}
            {status === "pending" && (
              <>
                <Loader2 className="animate-spin" size={popup ? 16 : 18} />
                <span>{t("btnConnecting")}</span>
              </>
            )}
            {status === "disconnected" && (
              <>
                <Wifi size={popup ? 16 : 18} />
                <span>{t("btnConnect")}</span>
              </>
            )}
          </button>
        </div>

        {/* Connection Details */}
        {!popup
          ? status === "connected" && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 dark:bg-slate-800/80">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                      <span className="w-3 h-3 bg-green-600 rounded-full animate-pulse"></span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {t("detStatus")}
                      </p>
                      <p className="text-sm text-slate-900 dark:text-slate-100 font-semibold">
                        {t("detOnline")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 dark:bg-slate-800/80">
                    <div className="flex items-center justify-center w-10 h-10 bg-violet-100 rounded-lg">
                      <Server className="text-violet-600" size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {t("detServer")}
                      </p>
                      <p className="text-sm text-slate-900 dark:text-slate-100 font-mono font-semibold">
                        {serverName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 dark:bg-slate-800/80">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-lg ${getSpeedBgColor(
                        networkSpeed.effectiveType
                      )}`}
                    >
                      <Zap
                        className={getSpeedColor(networkSpeed.effectiveType)}
                        size={20}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {t("detNetSpeed")}
                      </p>
                      <p
                        className={`text-sm font-semibold ${getSpeedColor(
                          networkSpeed.effectiveType
                        )}`}
                      >
                        {formatSpeed(networkSpeed.downlink)}
                        {networkSpeed.effectiveType !== "unknown" && (
                          <span className="text-xs ml-1 text-slate-500 dark:text-slate-400">
                            ({networkSpeed.effectiveType.toUpperCase()})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          : null}
      </div>
    </div>
  );
};
