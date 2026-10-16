import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Segmented, Toggle } from "../../components/Controls.jsx";
import Badge from "../../components/Badge.jsx";
import { ASSETS, ASSET_LABELS } from "../../lib/data.js";
import {
  FROZEN_WINDOWS,
  VALIDATED_SETTINGS,
  WINDOW_OPTIONS,
  sameSettings,
  settingsDeviations,
  settingsOf,
  validateSettings,
} from "../../lib/explorerState.js";
import { PERIODS } from "../../lib/periods.js";
import { REGIMES, vixThresholds } from "../../lib/regimes.js";
import { FREQUENCIES } from "../../lib/returns.js";
import { num } from "../../lib/format.js";
import { IS_PORTFOLIO, T } from "../../lib/edition.js";

const VOL = IS_PORTFOLIO ? "Vol index" : "VIX";

const REGIME_OPTIONS = [{ value: "all", label: "All days" }, ...REGIMES.map((r) => ({ value: r, label: r }))];

function AssetSelect({ id, label, value, onChange }) {
  return (
    <Field label={label}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {ASSETS.map((a) => (
          <option key={a} value={a}>
            {ASSET_LABELS[a]}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function PeriodControl({ data, state, dispatch }) {
  return (
    <div className="period-control">
      <Field label="Time period">
        <select
          className="select"
          value={state.period}
          onChange={(e) => dispatch({ type: "setPeriod", period: e.target.value })}
          aria-label="Time period"
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      {state.period === "custom" && (
        <div className="date-pair">
          <Field label="From">
            <input
              type="date"
              className="date-input"
              value={state.customRange.start}
              min={data.meta.sample_start}
              max={state.customRange.end}
              onChange={(e) => e.target.value && dispatch({ type: "setCustomRange", range: { start: e.target.value } })}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              className="date-input"
              value={state.customRange.end}
              min={state.customRange.start}
              max={data.meta.sample_end}
              onChange={(e) => e.target.value && dispatch({ type: "setCustomRange", range: { end: e.target.value } })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

/** One-line summary of the applied settings, shown on the panel toggle. */
function settingsSummary(state) {
  const f = FREQUENCIES[state.frequency];
  const t = state.thresholds;
  return `${f.label} · ${state.window}${f.short} window · ${VOL} ${t.p75}/${t.p90}${t.basis === "range" ? " (period)" : ""}`;
}

function Section({ title, description, children }) {
  return (
    <section className="settings-section">
      <h4>{title}</h4>
      <p className="settings-description">{description}</p>
      {children}
    </section>
  );
}

/**
 * Staged settings: edits are held in a draft until Apply, so several
 * parameters can change together and the charts recompute once.
 */
function AdvancedPanel({ data, state, dispatch, ctx, onClose }) {
  const applied = useMemo(() => settingsOf(state), [state]);
  const [draft, setDraft] = useState(applied);
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const issues = validateSettings(draft);
  const issue = (field) => issues.find((i) => i.field === field)?.message;
  const dirty = !sameSettings(draft, applied);
  const deviations = settingsDeviations(draft, ctx.rangeFull);
  const windows = WINDOW_OPTIONS[draft.frequency];
  const isPreset = windows.options.includes(Number(draft.window));
  const draftCutoffs = issue("p75") || issue("p90") ? null : vixThresholds(data.vix, ctx.idx, draft.thresholds);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setT = (patch) => setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, ...patch } }));

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="advanced-panel"
      id="advanced-settings"
      role="region"
      aria-label="Advanced settings"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="settings-grid">
        <Section
          title="Returns"
          description={
            IS_PORTFOLIO
              ? "Daily log returns are the default. Weekly and monthly resample the same synthetic prices."
              : "Daily log returns on the common trading calendar are the protocol definition. Weekly and monthly resample the same prices."
          }
        >
          <Segmented
            label="Return frequency"
            options={Object.entries(FREQUENCIES).map(([value, f]) => ({ value, label: f.label }))}
            value={draft.frequency}
            onChange={(frequency) => set({ frequency, window: WINDOW_OPTIONS[frequency].fallback })}
          />
          <p className="settings-current">Current: {FREQUENCIES[applied.frequency].label.toLowerCase()} returns</p>
        </Section>

        <Section
          title="Rolling window"
          description={
            IS_PORTFOLIO
              ? `Preset windows: ${FROZEN_WINDOWS.join(", ")} trading days, or a custom window.`
              : `Pre-registered windows: ${FROZEN_WINDOWS.join(", ")} trading days. Other windows are exploratory.`
          }
        >
          <div className="window-control">
            <Segmented
              label="Rolling window"
              options={[...windows.options.map((w) => ({ value: w, label: `${w}${FREQUENCIES[draft.frequency].short}` })), { value: "custom", label: "Custom" }]}
              value={isPreset ? Number(draft.window) : "custom"}
              onChange={(v) => set({ window: v === "custom" ? (isPreset ? "" : draft.window) : v })}
            />
            {!isPreset && (
              <input
                type="number"
                inputMode="numeric"
                className={`num-input ${issue("window") ? "invalid" : ""}`}
                min={windows.min}
                max={windows.max}
                value={draft.window}
                onChange={(e) => set({ window: e.target.value === "" ? "" : Number(e.target.value) })}
                aria-label={`Custom rolling window in ${FREQUENCIES[draft.frequency].unit}`}
                aria-invalid={Boolean(issue("window"))}
                aria-describedby="window-msg"
              />
            )}
          </div>
          <p id="window-msg" className={issue("window") ? "field-error" : "settings-current"}>
            {issue("window") ?? `Current: ${applied.window} ${FREQUENCIES[applied.frequency].unit}`}
          </p>
        </Section>

        <Section title="Statistical overlays" description="Display aids. The Fisher-z band is an approximation that assumes independent returns.">
          <div className="toggle-stack">
            <Toggle label="Fisher-z 95% band on rolling chart" checked={draft.showBand} onChange={(showBand) => set({ showBand })} />
            <Toggle label="OLS fit line on scatter" checked={draft.showFit} onChange={(showFit) => set({ showFit })} />
          </div>
        </Section>

        <Section
          title="Market regime definition"
          description={
            IS_PORTFOLIO
              ? "Percentiles of the synthetic vol index that separate Normal, Elevated and Severe days. Default: 75th / 90th over the full sample."
              : "VIX percentiles that separate Normal, Elevated and Severe days. Protocol: 75th / 90th over the full sample."
          }
        >
          <div className="threshold-row">
            <label className="inline-field">
              <span>Elevated ≥</span>
              <input
                type="number"
                className={`num-input ${issue("p75") ? "invalid" : ""}`}
                value={draft.thresholds.p75}
                onChange={(e) => setT({ p75: e.target.value === "" ? "" : Number(e.target.value) })}
                aria-label="Elevated percentile"
                aria-invalid={Boolean(issue("p75"))}
                aria-describedby="threshold-msg"
              />
              <span>pctl</span>
            </label>
            <label className="inline-field">
              <span>Severe &gt;</span>
              <input
                type="number"
                className={`num-input ${issue("p90") ? "invalid" : ""}`}
                value={draft.thresholds.p90}
                onChange={(e) => setT({ p90: e.target.value === "" ? "" : Number(e.target.value) })}
                aria-label="Severe percentile"
                aria-invalid={Boolean(issue("p90"))}
                aria-describedby="threshold-msg"
              />
              <span>pctl</span>
            </label>
          </div>
          <Segmented
            label={`${VOL} threshold basis`}
            options={[
              { value: "full", label: "Full-sample basis" },
              { value: "range", label: "Selected-period basis" },
            ]}
            value={draft.thresholds.basis}
            onChange={(basis) => setT({ basis })}
          />
          <p id="threshold-msg" className={issue("p75") || issue("p90") ? "field-error" : "settings-current"}>
            {issue("p75") ??
              issue("p90") ??
              `Cutoffs: elevated ≥ ${num(draftCutoffs.p75, 2)}, severe > ${num(draftCutoffs.p90, 2)} ${IS_PORTFOLIO ? "vol index" : "VIX"} (current ${num(ctx.regime.thresholds.p75, 2)} / ${num(ctx.regime.thresholds.p90, 2)})`}
          </p>
        </Section>
      </div>

      <footer className="settings-footer">
        <div className="settings-status" aria-live="polite">
          {IS_PORTFOLIO ? (
            deviations.length === 0 ? (
              <p>
                <Badge kind="derived" title="The demo's default settings">Default settings</Badge> These are the demo's default settings.
              </p>
            ) : (
              <p>
                <Badge kind="partial" title="Settings differ from the demo defaults">Custom settings</Badge>{" "}
                {deviations.map((d) => `${d.label}: ${d.current} (default: ${d.validated})`).join(" · ")}
              </p>
            )
          ) : deviations.length === 0 ? (
            <p>
              <Badge kind="validated">Validated settings</Badge> These settings match the research protocol. Each result is still checked against
              its artifact, so asset pair, period and regime also affect its status.
            </p>
          ) : (
            <p>
              <Badge kind="exploratory">Differs from validated</Badge>{" "}
              {deviations.map((d) => `${d.label}: ${d.current} (validated: ${d.validated})`).join(" · ")}
            </p>
          )}
          {dirty && <p className="settings-dirty">Unapplied changes. Charts still show the current settings.</p>}
        </div>
        <div className="settings-actions">
          <button type="button" className="text-button" onClick={() => setDraft(VALIDATED_SETTINGS)} disabled={sameSettings(draft, VALIDATED_SETTINGS)}>
            {IS_PORTFOLIO ? "Restore defaults" : "Restore validated defaults"}
          </button>
          <button type="button" className="ghost-button" onClick={() => setDraft(applied)} disabled={!dirty}>
            Discard
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => dispatch({ type: "applySettings", settings: draft })}
            disabled={!dirty || issues.length > 0}
          >
            Apply
          </button>
        </div>
      </footer>
    </div>
  );
}

export function ExplorerControls({ data, state, dispatch, ctx, advancedOpen, setAdvancedOpen }) {
  const toggleRef = useRef(null);
  const close = () => {
    setAdvancedOpen(false);
    toggleRef.current?.focus();
  };
  // Remount the panel when applied settings change (e.g. after Apply), resetting its draft.
  const panelKey = JSON.stringify(settingsOf(state));

  return (
    <div className="control-stack">
      <div className="control-bar">
        <div className="asset-pair">
          <AssetSelect id="asset-a" label="Asset A" value={state.assetA} onChange={(asset) => dispatch({ type: "setAsset", slot: "A", asset })} />
          <button type="button" className="swap-button" onClick={() => dispatch({ type: "swapAssets" })} aria-label="Swap asset A and asset B" title="Swap A and B">
            ⇄
          </button>
          <AssetSelect id="asset-b" label="Asset B" value={state.assetB} onChange={(asset) => dispatch({ type: "setAsset", slot: "B", asset })} />
        </div>
        <PeriodControl data={data} state={state} dispatch={dispatch} />
        <Field group label={T.regimeControl} hint={state.tab === "rolling" ? "Highlights matching days on the rolling chart" : "Filters observations"}>
          <Segmented label={T.regimeControl} options={REGIME_OPTIONS} value={state.regime} onChange={(regime) => dispatch({ type: "setRegime", regime })} />
        </Field>
        <button
          ref={toggleRef}
          type="button"
          className={`advanced-toggle ${advancedOpen ? "open" : ""}`}
          aria-expanded={advancedOpen}
          aria-controls="advanced-settings"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          <span className="advanced-label">Advanced settings</span>
          <span className="advanced-summary">{settingsSummary(state)}</span>
          <span className="chevron" aria-hidden="true" />
        </button>
      </div>

      {advancedOpen && <AdvancedPanel key={panelKey} data={data} state={state} dispatch={dispatch} ctx={ctx} onClose={close} />}
    </div>
  );
}

/**
 * Non-interactive copy of the control bar at its default values, used by the
 * loading skeleton so the layout matches the loaded page exactly.
 */
export function ControlsPlaceholder() {
  const noop = () => {};
  // Same option lists as the live selects, so native select widths match.
  const assetOptions = ASSETS.map((a) => (
    <option key={a} value={a}>
      {ASSET_LABELS[a]}
    </option>
  ));
  return (
    <div className="control-stack">
      <div className="control-bar">
        <div className="asset-pair">
          <Field label="Asset A">
            <select className="select" disabled value="BTC-USD" onChange={noop}>
              {assetOptions}
            </select>
          </Field>
          <button type="button" className="swap-button" disabled>
            ⇄
          </button>
          <Field label="Asset B">
            <select className="select" disabled value="SPY" onChange={noop}>
              {assetOptions}
            </select>
          </Field>
        </div>
        <div className="period-control">
          <Field label="Time period">
            <select className="select" disabled value="full" onChange={noop}>
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field group label={T.regimeControl} hint="Highlights matching days on the rolling chart">
          <Segmented label={T.regimeControl} options={REGIME_OPTIONS} value="all" onChange={noop} />
        </Field>
        <button type="button" className="advanced-toggle" disabled>
          <span className="advanced-label">Advanced settings</span>
          <span className="advanced-summary">Daily · 90d window · {VOL} 75/90</span>
          <span className="chevron" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
