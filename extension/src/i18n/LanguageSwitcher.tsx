import { useSettingsUi } from "./SettingsUiContext";

/** Segmented 中 / EN control; persists via {@link SETTINGS_UI_LOCALE_KEY}. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useSettingsUi();
  const seg =
    "px-2.5 py-1.5 text-xs font-semibold transition-colors min-w-[2.25rem]";
  const active = "bg-violet-600 text-white shadow-sm";
  const idle =
    "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <div
      className="inline-flex rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 dark:border-slate-600 dark:bg-slate-800/90"
      role="group"
      aria-label={t("langSwitcherAria")}
    >
      <button
        type="button"
        aria-pressed={locale === "zh"}
        onClick={() => setLocale("zh")}
        className={`${seg} rounded-md ${locale === "zh" ? active : idle}`}
      >
        中
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
        className={`${seg} rounded-md ${locale === "en" ? active : idle}`}
      >
        EN
      </button>
    </div>
  );
}
