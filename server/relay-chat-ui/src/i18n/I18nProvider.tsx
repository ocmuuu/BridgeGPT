import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { type Locale, messages, type Messages } from "./strings.js";

const STORAGE_KEY = "bridgegpt_relay_chat_locale";

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || "";
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "en" || s === "zh") return s;
  } catch {
    /* ignore */
  }
  return detectBrowserLocale();
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: Messages;
  /** BCP 47 for `Intl` formatters */
  intlLocale: string;
  /** Button label: switching *to* this language */
  langToggleLabel: string;
  langToggleAriaLabel: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === "en" ? "zh" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo((): I18nContextValue => {
    const t = messages[locale];
    const langToggleLabel =
      locale === "en" ? t.langToggleShowZh : t.langToggleShowEn;
    const langToggleAriaLabel =
      locale === "en" ? t.switchToChinese : t.switchToEnglish;
    return {
      locale,
      setLocale,
      toggleLocale,
      t,
      intlLocale: locale === "zh" ? "zh-CN" : "en-US",
      langToggleLabel,
      langToggleAriaLabel,
    };
  }, [locale, setLocale, toggleLocale]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
