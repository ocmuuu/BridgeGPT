import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SETTINGS_UI_LOCALE_KEY } from "@src/config";
import {
  SETTINGS_UI_STRINGS,
  type SettingsUiKey,
  type SettingsUiLocale,
} from "./settingsUiStrings";

function uiLanguageFromBrowser(): SettingsUiLocale {
  try {
    const lang = chrome.i18n.getUILanguage?.() ?? "";
    if (lang.toLowerCase().startsWith("zh")) return "zh";
  } catch {
    /* not extension context */
  }
  return "en";
}

function applySubstitutions(template: string, subs?: string[]): string {
  if (!subs?.length) return template;
  return subs.reduce(
    (acc, val, i) => acc.replaceAll(`$${i + 1}`, val),
    template
  );
}

type Ctx = {
  locale: SettingsUiLocale;
  setLocale: (l: SettingsUiLocale) => void;
  t: (key: SettingsUiKey, subs?: string[]) => string;
};

const SettingsUiContext = createContext<Ctx | null>(null);

export function SettingsUiProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SettingsUiLocale>(() =>
    uiLanguageFromBrowser()
  );

  useEffect(() => {
    chrome.storage.local.get(SETTINGS_UI_LOCALE_KEY, (r) => {
      if (chrome.runtime.lastError) return;
      const v = r[SETTINGS_UI_LOCALE_KEY];
      if (v === "en" || v === "zh") setLocaleState(v);
    });
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local" || !(SETTINGS_UI_LOCALE_KEY in changes)) return;
      const nv = changes[SETTINGS_UI_LOCALE_KEY]?.newValue;
      if (nv === "en" || nv === "zh") setLocaleState(nv);
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

  const setLocale = useCallback((l: SettingsUiLocale) => {
    setLocaleState(l);
    chrome.storage.local.set({ [SETTINGS_UI_LOCALE_KEY]: l });
  }, []);

  const t = useCallback(
    (key: SettingsUiKey, subs?: string[]) =>
      applySubstitutions(SETTINGS_UI_STRINGS[locale][key], subs),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <SettingsUiContext.Provider value={value}>
      {children}
    </SettingsUiContext.Provider>
  );
}

export function useSettingsUi(): Ctx {
  const ctx = useContext(SettingsUiContext);
  if (!ctx) {
    throw new Error("useSettingsUi must be used within SettingsUiProvider");
  }
  return ctx;
}
