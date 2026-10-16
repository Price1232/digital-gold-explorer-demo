import { useMemo, useState } from "react";
import Plot from "../components/Plot.jsx";
import { StatusBadge } from "../components/Badge.jsx";
import { ChipToggle, Field, Segmented, Toggle, WindowControl } from "../components/Controls.jsx";
import { Canvas, DataTable, ParityNote, ViewHeader } from "../components/Panels.jsx";
import { ASSET_LABELS, BETA_BENCHMARKS, COUNTERPARTS, assetCode } from "../lib/data.js";
import { FROZEN_WINDOWS } from "../lib/explorerState.js";
import { IS_PORTFOLIO, SYNTHETIC_REASON, T } from "../lib/edition.js";
import { regimeSegments } from "../lib/regimes.js";
import { fisherBand, maxAbsDiff, rollingBeta, rollingCorrelation, summarize } from "../lib/stats.js";
import { ASSET_COLORS, baseLayout, etfMarker, regimeShapes } from "../lib/theme.js";
import { num } from "../lib/format.js";

const RESEARCH_MODES = {
  correlation: {
    title: "Rolling correlation",
    description:
      "Bitcoin's rolling Pearson correlation of daily log returns with each counterpart. Research windows are read from the research tables; custom windows are recomputed in the browser.",
    frozenKey: "rolling_correlation",
    compute: rollingCorrelation,
    yTitle: "Correlation with Bitcoin",
    yRange: [-1, 1],
    refLines: [0],
    defaults: { selected: ["SPY", "GLD"], window: 90 },
  },
  beta: {
    title: "Rolling beta",
    description:
      "OLS beta of Bitcoin's daily log returns on each benchmark (Cov / Var). Research windows are read from the research tables; custom windows are recomputed in the browser.",
    frozenKey: "rolling_beta",
    compute: rollingBeta,
    yTitle: "Bitcoin beta",
    yRange: null,
    refLines: [0, 1],
    defaults: { selected: ["SPY", "GLD"], window: 252 },
  },
};

// Portfolio edition: the same calculations on synthetic series, always
// recomputed in the browser (there are no frozen research tables).
const ANCHOR = ASSET_LABELS["BTC-USD"];
const PORTFOLIO_MODES = {
  correlation: {
    title: "Rolling correlation",
    compute: rollingCorrelation,
    yRange: [-1, 1],
    refLines: [0],
    defaults: { selected: ["SPY", "GLD"], window: 90 },
    description: `Rolling Pearson correlation of the ${ANCHOR.toLowerCase()} series' daily log returns with each counterpart, computed in the browser from synthetic demo data.`,
    yTitle: `Correlation with ${ANCHOR.toLowerCase()}`,
    counterparts: COUNTERPARTS,
  },
  beta: {
    title: "Rolling beta",
    compute: rollingBeta,
    yRange: null,
    refLines: [0, 1],
    defaults: { selected: ["SPY", "GLD"], window: 252 },
    description: `OLS beta of the ${ANCHOR.toLowerCase()} series' daily log returns on each benchmark (Cov / Var), computed in the browser from synthetic demo data.`,
    yTitle: `${ANCHOR} beta`,
    counterparts: BETA_BENCHMARKS,
  },
};

const MODES = IS_PORTFOLIO ? PORTFOLIO_MODES : RESEARCH_MODES;

export default function RollingRelationship({ mode, ctx }) {
  const cfg = MODES[mode];
  const { data, idx, regime } = ctx;
  const counterparts = IS_PORTFOLIO ? cfg.counterparts : Object.keys(data[cfg.frozenKey]);
  // Portfolio: the usual window presets, none of which is a frozen research window.
  const frozenWindows = IS_PORTFOLIO ? [] : data.meta.frozen_windows[mode];
  const presetWindows = IS_PORTFOLIO ? FROZEN_WINDOWS : frozenWindows;

  const [selected, setSelected] = useState(cfg.defaults.selected);
  const [window, setWindow] = useState(cfg.defaults.window);
  const [shading, setShading] = useState("severe");
  const [band, setBand] = useState(false);

  const isFrozenWindow = frozenWindows.includes(window);

  const series = useMemo(() => {
    const btc = data.returns["BTC-USD"];
    return Object.fromEntries(
      selected.map((asset) => {
        const recomputed = cfg.compute(btc, data.returns[asset], window);
        if (!isFrozenWindow) return [asset, { values: recomputed, parity: null }];
        const frozen = data[cfg.frozenKey][asset][String(window)];
        return [asset, { values: frozen, parity: maxAbsDiff(frozen, recomputed) }];
      }),
    );
  }, [data, selected, window, isFrozenWindow, cfg]);

  const [start, end] = idx;
  const dates = useMemo(() => data.dates.slice(start, end + 1), [data.dates, start, end]);

  const figure = useMemo(() => {
    const traces = [];
    for (const asset of selected) {
      const values = series[asset].values.slice(start, end + 1);
      const color = ASSET_COLORS[asset];
      if (band && mode === "correlation") {
        const { lo, hi } = fisherBand(values, window);
        traces.push(
          { x: dates, y: hi, type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
          {
            x: dates,
            y: lo,
            type: "scatter",
            mode: "lines",
            line: { width: 0 },
            fill: "tonexty",
            fillcolor: `${color}26`,
            hoverinfo: "skip",
            showlegend: false,
          },
        );
      }
      traces.push({
        x: dates,
        y: values,
        type: "scatter",
        mode: "lines",
        name: ASSET_LABELS[asset],
        line: { color, width: 1.6 },
        hovertemplate: "%{y:.3f}",
        connectgaps: false,
      });
    }

    const targets = shading === "none" ? [] : shading === "severe" ? ["Severe"] : ["Elevated", "Severe"];
    const shapes = regimeShapes(regimeSegments(data.dates, regime.labels, targets, idx));
    const annotations = [];
    for (const y of cfg.refLines) {
      shapes.push({
        type: "line",
        xref: "paper",
        yref: "y",
        x0: 0,
        x1: 1,
        y0: y,
        y1: y,
        line: { color: "#3a4757", width: 1, dash: y === 0 ? "solid" : "dash" },
      });
    }
    const etf = data.meta.etf_era_start;
    if (etf >= dates[0] && etf <= dates[dates.length - 1]) {
      const m = etfMarker(etf);
      shapes.push(m.shape);
      annotations.push(m.annotation);
    }
    const layout = baseLayout({
      shapes,
      annotations,
      yaxis: { ...baseLayout().yaxis, title: { text: cfg.yTitle }, range: cfg.yRange ?? undefined },
      xaxis: { ...baseLayout().xaxis, type: "date" },
    });
    return { traces, layout };
  }, [selected, series, start, end, dates, band, mode, window, shading, data, regime.labels, idx, cfg]);

  const reasons = IS_PORTFOLIO ? [SYNTHETIC_REASON] : [];
  if (!isFrozenWindow && !IS_PORTFOLIO) reasons.push(`custom ${window}-day window`);
  if (band && mode === "correlation") reasons.push("Fisher-z bands assume i.i.d. returns");
  if (shading !== "none" && !regime.isFrozen) reasons.push(`stress shading uses non-frozen ${T.vol} thresholds`);

  const rows = selected.map((asset) => {
    const s = summarize(series[asset].values.slice(start, end + 1));
    return { key: asset, asset, ...s };
  });

  return (
    <>
      <ViewHeader title={cfg.title} description={cfg.description} badge={<StatusBadge reasons={reasons} />}>
        <Field group label={mode === "correlation" ? "Counterparts" : "Benchmarks"}>
          <ChipToggle
            options={counterparts.map((a) => ({ value: a, label: assetCode(a) }))}
            selected={selected}
            onChange={setSelected}
            colors={ASSET_COLORS}
          />
        </Field>
        <Field
          group
          label="Window (trading days)"
          hint={
            IS_PORTFOLIO
              ? presetWindows.includes(window) ? "Preset window" : "Custom: 10–504 days"
              : isFrozenWindow ? "Pre-registered window" : "Custom: 10–504 days"
          }
        >
          <WindowControl frozen={presetWindows} value={window} onChange={setWindow} />
        </Field>
        <Field group label="Stress shading">
          <Segmented
            label="Stress shading"
            options={[
              { value: "none", label: "None" },
              { value: "severe", label: "Severe" },
              { value: "both", label: "Elevated + severe" },
            ]}
            value={shading}
            onChange={setShading}
          />
        </Field>
        {mode === "correlation" && (
          <Field group label="Uncertainty">
            <Toggle label="Fisher-z 95% band" checked={band} onChange={setBand} />
          </Field>
        )}
      </ViewHeader>

      <Canvas
        title={`${ASSET_LABELS["BTC-USD"]} ${mode === "correlation" ? "correlation" : "beta"} · ${window}-day window`}
        note={`${dates[0]} → ${dates[dates.length - 1]}`}
      >
        <Plot data={figure.traces} layout={figure.layout} height={440} />
        <DataTable
          dense
          columns={[
            { key: "asset", label: "Counterpart", render: (r) => ASSET_LABELS[r.asset] },
            { key: "latest", label: "Latest", align: "right", render: (r) => num(r.latest, 3) },
            { key: "mean", label: "Mean", align: "right", render: (r) => num(r.mean, 3) },
            { key: "min", label: "Min", align: "right", render: (r) => num(r.min, 3) },
            { key: "max", label: "Max", align: "right", render: (r) => num(r.max, 3) },
            { key: "n", label: "Points", align: "right", render: (r) => (r.n ?? 0).toLocaleString() },
          ]}
          rows={rows}
        />
        {isFrozenWindow &&
          selected.map((asset) => (
            <ParityNote key={asset} parity={series[asset].parity} what={`BTC–${asset} ${window}d`} />
          ))}
        {!isFrozenWindow && !presetWindows.includes(window) && (
          <p className="canvas-footnote">
            Custom windows are computed over the full sample and then clipped to the date range, so early points in the
            range still use the full look-back.
          </p>
        )}
      </Canvas>
    </>
  );
}
