import { useEffect, useState } from "react";

/**
 * Numeric input that holds a draft string while focused.
 *
 * A plain `Number(e.target.value)` handler makes the field unusable: clearing
 * it snaps to 0, and typing a leading "-" snaps to 0 before the digits arrive.
 * Keeping the raw string until blur/Enter lets people actually type.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
  disabled,
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const [focused, setFocused] = useState(false);

  // Track external changes (drag, undo) unless the user is mid-edit.
  useEffect(() => {
    if (!focused) setDraft(String(value ?? ""));
  }, [value, focused]);

  const clamp = (n) => Math.min(max, Math.max(min, n));

  const commit = (raw) => {
    const parsed = Number(raw);
    if (raw === "" || raw === "-" || Number.isNaN(parsed)) {
      setDraft(String(value ?? ""));
      return;
    }
    const next = clamp(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="cs-field">
      {label && (
        <label>
          {label}
          {suffix ? ` (${suffix})` : ""}
        </label>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
            e.currentTarget.blur();
            return;
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const base = Number(draft);
            if (Number.isNaN(base)) return;
            // Shift multiplies the step, the same convention as the canvas nudge.
            const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const next = clamp(base + delta);
            setDraft(String(next));
            onChange(next);
          }
        }}
      />
    </div>
  );
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Colour swatch paired with a hex text field.
 *
 * The native picker alone can't be typed into or pasted from, which matters
 * when matching an institution's exact brand colour.
 */
export function ColorField({ label, value, onChange, fallback = "#000000", allowEmpty }) {
  const [draft, setDraft] = useState(value || "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value || "");
  }, [value, focused]);

  const swatchValue = HEX_RE.test(value || "") ? value : fallback;

  return (
    <div className="cs-field">
      {label && <label>{label}</label>}
      <div className="cs-color">
        <input
          type="color"
          value={swatchValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label ? `${label} colour picker` : "Colour picker"}
        />
        <input
          type="text"
          value={draft}
          placeholder={allowEmpty ? "none" : fallback}
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            const trimmed = draft.trim();
            if (allowEmpty && trimmed === "") {
              onChange("");
              return;
            }
            if (HEX_RE.test(trimmed)) onChange(trimmed.toLowerCase());
            else setDraft(value || "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label={label ? `${label} hex value` : "Hex colour value"}
        />
      </div>
    </div>
  );
}

/** Slider with a visible numeric readout — a bare range gives no feedback. */
export function RangeField({ label, value, onChange, min = 0, max = 1, step = 0.05, format }) {
  const display = format ? format(value) : value;
  return (
    <div className="cs-field">
      {label && <label>{label}</label>}
      <div className="cs-range">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="cs-range-value">{display}</span>
      </div>
    </div>
  );
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <div className="cs-field">
      {label && <label>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SegmentedField({ label, value, onChange, options }) {
  return (
    <div className="cs-field">
      {label && <label>{label}</label>}
      <div className="cs-segments" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`cs-segment${value === opt.value ? " cs-segment--active" : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            title={opt.title || opt.label}
          >
            {opt.icon || opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
