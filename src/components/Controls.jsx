import { useRef } from "react";
import { nextRadioIndex } from "../lib/keyboard.js";

/**
 * Labelled control wrapper. Use `group` when the child is a composite control
 * (radio group, chips, toggles): a <label> would forward clicks on its text to
 * the first button inside, so groups get a plain container instead and name
 * themselves via their own `label`.
 */
export function Field({ label, hint, children, group = false }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
  );
}

/**
 * Single-select segmented control with radio-group semantics: one tab stop
 * (the checked option), arrow keys move and select, Home/End jump, and
 * Space/Enter activate the focused option.
 */
export function Segmented({ options, value, onChange, label }) {
  const refs = useRef([]);
  const checked = options.findIndex((o) => o.value === value);
  const focusable = checked >= 0 ? checked : 0;

  const onKeyDown = (event) => {
    const next = nextRadioIndex(event.key, focusable, options.length);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={i === focusable ? 0 : -1}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChipToggle({ options, selected, onChange, colors = {} }) {
  const toggle = (value) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    if (next.length) onChange(next);
  };
  return (
    <div className="chips">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            className={`chip ${on ? "on" : ""}`}
            onClick={() => toggle(o.value)}
          >
            <span className="chip-dot" style={{ background: colors[o.value] ?? "#7d8796" }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Window selector: frozen windows plus a bounded custom (exploratory) window. */
export function WindowControl({ frozen, value, onChange, min = 10, max = 504 }) {
  const isCustom = !frozen.includes(value);
  return (
    <div className="window-control">
      <Segmented
        label="Rolling window"
        options={[...frozen.map((w) => ({ value: w, label: `${w}d` })), { value: "custom", label: "Custom" }]}
        value={isCustom ? "custom" : value}
        onChange={(v) => onChange(v === "custom" ? (isCustom ? value : 60) : v)}
      />
      {isCustom && (
        <input
          type="number"
          className="num-input"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          aria-label="Custom window in trading days"
        />
      )}
    </div>
  );
}
