import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw, Server } from "lucide-react";
import {
  DEFAULT_RELAY_BASE_URL,
  OFFICIAL_RELAY_BASE_URL,
  normalizeRelayBase,
  RELAY_SERVER_STORAGE_KEY,
  relayBaseFromStoredString,
} from "@src/config";
import { useSettingsUi } from "@src/i18n/SettingsUiContext";

function parseRelayUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname === "" ? "/" : u.pathname;
    return normalizeRelayBase(`${u.origin}${path}`);
  } catch {
    return null;
  }
}

export const RelayServerSection = () => {
  const { t } = useSettingsUi();
  const [input, setInput] = useState(DEFAULT_RELAY_BASE_URL);
  const [savedHint, setSavedHint] = useState(false);
  const [error, setError] = useState("");

  const loadFromStorage = useCallback(() => {
    chrome.storage.local.get(RELAY_SERVER_STORAGE_KEY, (r) => {
      if (chrome.runtime.lastError) return;
      const v = r[RELAY_SERVER_STORAGE_KEY];
      setInput(
        relayBaseFromStoredString(
          typeof v === "string" ? v : undefined
        )
      );
    });
  }, []);

  useEffect(() => {
    loadFromStorage();
    const onChanged: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local" || !(RELAY_SERVER_STORAGE_KEY in changes)) return;
      loadFromStorage();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [loadFromStorage]);

  const save = () => {
    setError("");
    const parsed = parseRelayUrl(input);
    if (input.trim() && !parsed) {
      setError(t("relayErrUrl"));
      return;
    }
    if (!input.trim() || parsed === normalizeRelayBase(DEFAULT_RELAY_BASE_URL)) {
      chrome.storage.local.remove(RELAY_SERVER_STORAGE_KEY, () => {
        setInput(DEFAULT_RELAY_BASE_URL);
        setSavedHint(true);
        setTimeout(() => setSavedHint(false), 2000);
      });
      return;
    }
    chrome.storage.local.set({ [RELAY_SERVER_STORAGE_KEY]: parsed }, () => {
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2000);
    });
  };

  /** Always the public relay (see OFFICIAL_RELAY_BASE_URL), not build-time DEFAULT_RELAY_BASE_URL. */
  const resetToDefault = () => {
    setError("");
    const official = normalizeRelayBase(OFFICIAL_RELAY_BASE_URL);
    chrome.storage.local.set({ [RELAY_SERVER_STORAGE_KEY]: official }, () => {
      if (chrome.runtime.lastError) return;
      setInput(official);
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2000);
    });
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-6 mb-6 shadow-sm shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700 dark:shadow-black/20">
      <div className="flex items-center gap-3 mb-4">
        <Server className="text-slate-700 dark:text-slate-300" size={24} />
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("relayTitle")}
        </h2>
      </div>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">
        {t("relayIntro")}
      </p>

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {t("relayLabel")}
      </label>
      <div className="flex flex-col sm:flex-row gap-3 mb-2">
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          spellCheck={false}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-3 font-mono text-sm text-slate-900 bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder={DEFAULT_RELAY_BASE_URL}
        />
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={resetToDefault}
            title={t("relayResetTitle", [
              OFFICIAL_RELAY_BASE_URL.replace(/\/+$/, ""),
            ])}
            className="px-3 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={save}
            className="px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm shadow-sm shadow-violet-600/20 dark:shadow-violet-900/40"
          >
            {savedHint ? t("relaySaved") : t("relaySave")}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
        {t("relayBuiltIn")}{" "}
        <span className="font-mono text-slate-600 dark:text-slate-300 break-all">
          {OFFICIAL_RELAY_BASE_URL}
        </span>
      </p>
      {error ? (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      ) : null}
    </div>
  );
};
