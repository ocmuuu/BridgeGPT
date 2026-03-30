import { useI18n } from "../i18n/I18nProvider.js";

type Props = { className?: string };

/** Same copy as the sidebar “Set up” card (extension + URL api_key). */
export function RelaySetupHint({ className = "" }: Props) {
  const { t } = useI18n();
  return (
    <div
      className={["sidebar-setup", className].filter(Boolean).join(" ")}
      role="region"
      aria-label={t.setupTitle}
    >
      <p className="sidebar-setup-title">{t.setupTitle}</p>
      <p>
        {t.setupP1a}
        <strong>BridgeGPT</strong>
        {t.setupP1b}
        <strong>{t.setupP1c}</strong>
        {t.setupP1d}
      </p>
      <p>
        {t.setupP2Before}
        <code>?api_key=&lt;room id&gt;</code>
        {t.setupP2After}
      </p>
    </div>
  );
}
