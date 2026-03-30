import { useCallback, useLayoutEffect, useRef } from "react";

import { useI18n } from "../i18n/I18nProvider.js";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  busy: boolean;
};

function syncTextareaHeight(el: HTMLTextAreaElement) {
  const computed = getComputedStyle(el);
  const maxPx = parseFloat(computed.maxHeight);
  const cap =
    Number.isFinite(maxPx) && maxPx > 0
      ? maxPx
      : 8 * parseFloat(computed.fontSize || "16");
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
}

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  busy,
}: Props) {
  const { t } = useI18n();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    syncTextareaHeight(el);
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [value, placeholder, disabled, busy, resize]);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [resize]);

  return (
    <div className="composer-wrap">
      <div className={`composer-bar ${disabled ? "disabled" : ""}`}>
        <textarea
          ref={taRef}
          className="composer-input"
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled || busy}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="button"
          className="composer-send"
          disabled={disabled || busy || !value.trim()}
          onClick={onSend}
        >
          {busy ? "…" : t.composerSend}
        </button>
      </div>
    </div>
  );
}
