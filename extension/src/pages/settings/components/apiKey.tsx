import React, { useEffect, useState } from "react";
import { Copy, Check, ExternalLink as ExternalLinkIcon, RefreshCw, KeyRound } from "lucide-react";
import {
  API_KEY_STORAGE_KEY,
  DEFAULT_RELAY_BASE_URL,
  LEGACY_ROOM_ID_STORAGE_KEY,
  RELAY_SERVER_STORAGE_KEY,
} from "@src/config";

type OpenAIClientConfig = { v1BaseUrl: string; apiKey: string };

function defaultV1BaseUrl(): string {
  return `${DEFAULT_RELAY_BASE_URL.replace(/\/+$/, "")}/v1`;
}

export const ApiKeySection = () => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [resettingKey, setResettingKey] = useState(false);
  const [cfg, setCfg] = useState<OpenAIClientConfig>(() => ({
    v1BaseUrl: defaultV1BaseUrl(),
    apiKey: "",
  }));

  const v1BaseUrl = cfg.v1BaseUrl || defaultV1BaseUrl();
  const apiKey = cfg.apiKey;

  const testUrl =
    apiKey.length > 0
      ? `${new URL(v1BaseUrl).origin}/?api_key=${encodeURIComponent(apiKey)}&message=how+to+use+apis`
      : "";

  useEffect(() => {
    chrome.storage.local.get(
      [API_KEY_STORAGE_KEY, LEGACY_ROOM_ID_STORAGE_KEY],
      (r) => {
        const fromStorage =
          (typeof r[API_KEY_STORAGE_KEY] === "string" &&
            r[API_KEY_STORAGE_KEY]) ||
          (typeof r[LEGACY_ROOM_ID_STORAGE_KEY] === "string" &&
            r[LEGACY_ROOM_ID_STORAGE_KEY]) ||
          "";
        setCfg((prev) => ({
          v1BaseUrl: prev.v1BaseUrl || defaultV1BaseUrl(),
          apiKey: fromStorage || prev.apiKey,
        }));
      }
    );

    chrome.runtime.sendMessage({ type: "get_connect_url" }, () => {
      void chrome.runtime.lastError;
    });
    const onMsg = (msg: { type?: string; content?: OpenAIClientConfig }) => {
      if (msg.type === "set_openai_config" && msg.content) {
        setCfg(msg.content);
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  useEffect(() => {
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return;
      if (
        API_KEY_STORAGE_KEY in changes ||
        LEGACY_ROOM_ID_STORAGE_KEY in changes ||
        RELAY_SERVER_STORAGE_KEY in changes
      ) {
        chrome.runtime.sendMessage({ type: "get_connect_url" }, () => {
          void chrome.runtime.lastError;
        });
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

  const copyKey = () => {
    if (!apiKey) return;
    void navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const regenerateApiKey = () => {
    if (
      !window.confirm(
        "Generate a new api_key?\n\n" +
          "Update every client (OpenAI SDK, Gemini HTTP, curl, web chat cookie). " +
          "Open web chat again from here or use ?api_key= once. " +
          "The old key will stop working for this extension."
      )
    ) {
      return;
    }
    setResettingKey(true);
    chrome.runtime.sendMessage(
      { type: "reset_api_key" },
      (res: { ok?: boolean; error?: string; apiKey?: string } | undefined) => {
        setResettingKey(false);
        if (chrome.runtime.lastError) {
          window.alert(chrome.runtime.lastError.message);
          return;
        }
        if (!res?.ok) {
          window.alert(res?.error ?? "Could not regenerate api_key.");
          return;
        }
        if (res.apiKey) {
          setCfg((prev) => ({ ...prev, apiKey: res.apiKey! }));
        }
      }
    );
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-6 mb-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
      <div className="flex items-center gap-3 mb-4">
        <KeyRound className="text-slate-700 dark:text-slate-300" size={24} />
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          API key
        </h2>
      </div>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">
        This secret identifies your browser session to the relay. Use it as{" "}
        <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
          Authorization: Bearer …
        </code>
        ,{" "}
        <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">?key=</code>{" "}
        (Gemini-style), or{" "}
        <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">x-goog-api-key</code>
        . Stored only in this browser.
      </p>

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        api_key
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        Looks like an OpenAI key (
        <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">sk-bridgegpt-…</code>
        ). Regenerate if it may have leaked.
      </p>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-mono text-slate-900 dark:bg-slate-800/80 dark:border-slate-600 dark:text-slate-100 text-sm break-all">
          {apiKey || "Loading…"}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={regenerateApiKey}
            disabled={!apiKey || resettingKey}
            title="Generate a new random api_key"
            className="flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-medium px-4 py-3 rounded-xl transition-colors dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
          >
            <RefreshCw
              size={18}
              className={resettingKey ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
          <button
            type="button"
            onClick={copyKey}
            disabled={!apiKey}
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-sm shadow-violet-600/20"
          >
            {copiedKey ? <Check size={18} /> : <Copy size={18} />}
            <span>{copiedKey ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
        Open web chat (first visit saves a cookie; the key is removed from the URL)
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-mono text-slate-900 dark:bg-slate-800/80 dark:border-slate-600 dark:text-slate-100 text-xs break-all">
          {testUrl || "(shown when api_key is ready)"}
        </div>
        <button
          type="button"
          onClick={() => testUrl && window.open(testUrl, "_blank")}
          disabled={!testUrl}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-sm shadow-violet-600/20"
        >
          <ExternalLinkIcon />
        </button>
      </div>
    </div>
  );
};
