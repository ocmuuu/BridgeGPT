type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  busy: boolean;
};

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  busy,
}: Props) {
  return (
    <div className="composer-wrap">
      <div className={`composer-bar ${disabled ? "disabled" : ""}`}>
        <textarea
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
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
