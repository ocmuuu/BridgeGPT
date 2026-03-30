import React, { useEffect, useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Info,
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

type ClientTab = "openai" | "gemini";

export const ApiUrlSection = () => {
  const [tab, setTab] = useState<ClientTab>("openai");
  const [copiedBase, setCopiedBase] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedGeminiCurl, setCopiedGeminiCurl] = useState(false);
  const [cfg, setCfg] = useState<OpenAIClientConfig>(() => ({
    v1BaseUrl: defaultV1BaseUrl(),
    apiKey: "",
  }));

  const v1BaseUrl = cfg.v1BaseUrl || defaultV1BaseUrl();
  const apiKey = cfg.apiKey;
  const relayOrigin = (() => {
    try {
      return new URL(v1BaseUrl).origin;
    } catch {
      return "";
    }
  })();

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

  const geminiModel = "gemini-3.1-flash";
  const geminiGenerateUrl = `${relayOrigin}/v1beta/models/${geminiModel}:generateContent`;
  const geminiStreamUrl = `${relayOrigin}/v1beta/models/${geminiModel}:streamGenerateContent`;

  const geminiCurlGenerate = `curl -sS "${geminiGenerateUrl}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}'`;

  const geminiCurlStream = `curl -sS -N "${geminiStreamUrl}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}'`;

  const geminiPyExample = apiKey
    ? `import requests

url = "${geminiGenerateUrl}"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
}
body = {"contents": [{"role": "user", "parts": [{"text": "Hello"}]}]}
r = requests.post(url, headers=headers, json=body, timeout=120)
r.raise_for_status()
print(r.json()["candidates"][0]["content"]["parts"][0]["text"])`
    : "";

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

  const copyGeminiCurl = () => {
    if (!apiKey) return;
    const oneLine = geminiCurlGenerate
      .replace(/\\\n[ \t]*/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    void navigator.clipboard.writeText(oneLine);
    setCopiedGeminiCurl(true);
    setTimeout(() => setCopiedGeminiCurl(false), 2000);
  };

  const tabBtn =
    "px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-transparent";
  const tabActive =
    "bg-violet-600 text-white shadow-sm shadow-violet-600/25 dark:shadow-violet-900/40";
  const tabIdle =
    "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <div>
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Client API
          </h2>
          <div
            className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-600"
            role="tablist"
            aria-label="API flavor"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "openai"}
              id="tab-openai"
              className={`${tabBtn} ${tab === "openai" ? tabActive : tabIdle}`}
              onClick={() => setTab("openai")}
            >
              OpenAI-compatible
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "gemini"}
              id="tab-gemini"
              className={`${tabBtn} ${tab === "gemini" ? tabActive : tabIdle}`}
              onClick={() => setTab("gemini")}
            >
              Gemini API
            </button>
          </div>
        </div>

        {tab === "openai" ? (
          <div role="tabpanel" aria-labelledby="tab-openai">
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Set{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">base_url</code> to
              the relay&apos;s{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">/v1</code>. Use the
              same <strong>api_key</strong> from the section above.
            </p>

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
            </div>

            <div className="bg-violet-50 border border-violet-200/80 rounded-xl p-4 mb-4 dark:bg-violet-950/40 dark:border-violet-800/60">
              <div className="flex items-start gap-3">
                <Info className="text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Steps</h3>
                  <ol className="text-sm text-slate-700 dark:text-slate-300 space-y-1 list-decimal list-inside">
                    <li>Click Connect and stay signed in on chatgpt.com</li>
                    <li>
                      Python / curl below embed your api_key—copy and run (no placeholders)
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
                <code className="bg-white dark:bg-slate-900 px-1 rounded">Authorization: Bearer</code>{" "}
                with the same api_key as above.
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
        ) : (
          <div role="tabpanel" aria-labelledby="tab-gemini">
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">
              Same relay host as your OpenAI <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">base_url</code>,
              but use Google-style paths under{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">/v1beta/models/…</code>.
              The extension drives <strong>gemini.google.com</strong> when you call these endpoints.
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6 list-disc list-inside">
              <li>
                Auth: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization: Bearer &lt;api_key&gt;</code>, or{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">?key=</code>, or{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">x-goog-api-key</code>
              </li>
              <li>
                Non-stream:{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs break-all">
                  POST …/v1beta/models/&lt;model&gt;:generateContent
                </code>
              </li>
              <li>
                Stream (SSE):{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs break-all">
                  POST …/v1beta/models/&lt;model&gt;:streamGenerateContent
                </code>
              </li>
              <li>
                List models:{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">GET …/v1beta/models</code>
              </li>
            </ul>

            <div className="bg-violet-50 border border-violet-200/80 rounded-xl p-4 mb-4 dark:bg-violet-950/40 dark:border-violet-800/60">
              <div className="flex items-start gap-3">
                <Info className="text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Steps</h3>
                  <ol className="text-sm text-slate-700 dark:text-slate-300 space-y-1 list-decimal list-inside">
                    <li>Click Connect and stay signed in on gemini.google.com</li>
                    <li>Call the endpoints below with your api_key (examples use Bearer)</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-4 dark:bg-slate-800/50 dark:border-slate-600">
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm">
                Example URLs ({geminiModel})
              </h3>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all mb-2">
                {geminiGenerateUrl}
              </p>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                {geminiStreamUrl}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-4 dark:bg-slate-800/50 dark:border-slate-600">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">curl (generateContent)</h3>
                <button
                  type="button"
                  onClick={copyGeminiCurl}
                  disabled={!apiKey}
                  className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 font-medium disabled:opacity-50"
                >
                  {copiedGeminiCurl ? <Check size={16} /> : <Copy size={16} />}
                  {copiedGeminiCurl ? "Copied one-liner" : "Copy as one line"}
                </button>
              </div>
              {apiKey ? (
                <pre className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto dark:bg-slate-950 dark:border-slate-700 mb-3">
                  <code className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre">{geminiCurlGenerate}</code>
                </pre>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-2 mb-3">Loading api_key…</p>
              )}
              <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">streamGenerateContent (SSE)</h4>
              {apiKey ? (
                <pre className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto dark:bg-slate-950 dark:border-slate-700">
                  <code className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre">{geminiCurlStream}</code>
                </pre>
              ) : null}
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-4 dark:bg-slate-800/50 dark:border-slate-600">
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm">Python (requests)</h3>
              {apiKey ? (
                <pre className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto dark:bg-slate-950 dark:border-slate-700">
                  <code className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre">{geminiPyExample}</code>
                </pre>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Loading api_key…</p>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Alternative: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">POST /v1/chat/completions</code> with header{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">X-Bridge-Provider: gemini</code> still routes to the Gemini tab.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
