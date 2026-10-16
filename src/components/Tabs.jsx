import { useRef } from "react";
import { nextTabIndex } from "../lib/keyboard.js";

/**
 * Accessible tablist with roving tabindex: arrow keys, Home and End move
 * focus and select (automatic activation).
 */
export default function Tabs({ tabs, active, onChange, label, panelId }) {
  const refs = useRef([]);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === active));

  const onKeyDown = (event) => {
    const next = nextTabIndex(event.key, activeIndex, tabs.length);
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={i === activeIndex}
          aria-controls={panelId}
          tabIndex={i === activeIndex ? 0 : -1}
          className={i === activeIndex ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
