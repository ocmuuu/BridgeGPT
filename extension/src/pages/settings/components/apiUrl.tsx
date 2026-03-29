import React, { useEffect, useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Info,
  ExternalLinkIcon,
  RefreshCw,
} from "lucide-react";
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

export const ApiUrlSection = () => {
  const [copiedBase, setCopiedBase] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
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

  const copyBase = () => {
    void navigator.clipboard.writeText(v1BaseUrl);
    setCopiedBase(true);
    setTimeout(() => setCopiedBase(false), 2000);
  };

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
          "Update every OpenAI client and curl command to use the new value. " +
          "Web chat on the relay uses a cookie—open it again from here or add ?api_key= once. " +
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

  /** Embeds real base_url and api_key; copy-paste ready. */
  const pyExample = `from openai import OpenAI

client = OpenAI(
    base_url="${v1BaseUrl}",
    api_key="${apiKey}",
)

response = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)`;

  const curlExample = `curl -sS "${v1BaseUrl}/chat/completions" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-5","messages":[{"role":"user","content":"Hello"}]}'`;

  const copyCurl = () => {
    if (!apiKey) return;
    const oneLine = curlExample
      .replace(/\\\n[ \t]*/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    void navigator.clipboard.writeText(oneLine);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div>
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
            OpenAI-compatible client
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Set <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">base_url</code> to
            the relay&apos;s{" "}
            <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">/v1</code>; set{" "}
            <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">api_key</code> to the
            value below (generated for this extension—copy-paste ready).
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              base_url (OpenAI client)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-mono text-slate-900 dark:bg-slate-800/80 dark:border-slate-600 dark:text-slate-100 text-sm break-all">
                {v1BaseUrl}
              </div>
              <button
                type="button"
                onClick={copyBase}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-sm shadow-violet-600/20"
              >
                {copiedBase ? <Check size={18} /> : <Copy size={18} />}
                <span>{copiedBase ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              api_key
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Looks like an OpenAI key (<code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">sk-bridgegpt-…</code>
              ). Stored only in this browser. Regenerate if you need a new secret.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
          </div>
        </div>

        <div className="mb-4">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Open web chat (first visit sets a cookie; the key is removed from the URL)
          </p>
        </div>

        <div className="flex items-center gap-3 mb-6">
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

        <div className="bg-violet-50 border border-violet-200/80 rounded-xl p-4 mb-4 dark:bg-violet-950/40 dark:border-violet-800/60">
          <div className="flex items-start gap-3">
            <Info className="text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Steps</h3>
              <ol className="text-sm text-slate-700 dark:text-slate-300 space-y-1 list-decimal list-inside">
                <li>Click Connect and stay signed in on chatgpt.com</li>
                <li>
                  Python / curl below embed your api_key—copy and run (no
                  placeholders to replace)
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-4 dark:bg-slate-800/50 dark:border-slate-600">
          <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm">Python</h3>
          {apiKey ? (
            <pre className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto dark:bg-slate-950 dark:border-slate-700">
              <code className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre">{pyExample}</code>
            </pre>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Loading api_key…</p>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-4 dark:bg-slate-800/50 dark:border-slate-600">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">curl</h3>
            <button
              type="button"
              onClick={copyCurl}
              disabled={!apiKey}
              className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 font-medium disabled:opacity-50"
            >
              {copiedCurl ? <Check size={16} /> : <Copy size={16} />}
              {copiedCurl ? "Copied one-liner" : "Copy as one line"}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Same as OpenAI: <code className="bg-white dark:bg-slate-900 px-1 rounded">Authorization: Bearer</code>{" "}
            followed by the same api_key (already in the command).
          </p>
          {apiKey ? (
            <pre className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto dark:bg-slate-950 dark:border-slate-700">
              <code className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre">{curlExample}</code>
            </pre>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Loading api_key…</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400">OpenAI Python SDK</p>
          <a
            href="https://github.com/openai/openai-python"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 font-medium text-sm transition-colors"
          >
            Docs
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
};
