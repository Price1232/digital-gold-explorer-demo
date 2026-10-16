import { useMemo } from "react";
import Plot from "../../components/Plot.jsx";
import Badge from "../../components/Badge.jsx";
import StatePanel from "../../components/States.jsx";
import Interpretation from "../../components/Interpretation.jsx";
import { ASSET_LABELS, assetCode } from "../../lib/data.js";
import { IS_PORTFOLIO, T } from "../../lib/edition.js";
import { describeSeries, regimeSplitMean, rollingPair } from "../../lib/analysis.js";
import { rangeIndices } from "../../lib/periods.js";
import { regimeSegments } from "../../lib/regimes.js";
import { frozenRolling, rollingStatus, summaryStatus } from "../../lib/research.js";
import { FREQUENCIES } from "../../lib/returns.js";
import { fisherBand } from "../../lib/stats.js";
import { CROSSHAIR, GOLD, RANGE_SELECTOR, REGIME_COLORS, REGIME_FILLS, baseLayout, etfMarker, regimeShapes } from "../../lib/theme.js";
import { longDate, num } from "../../lib/format.js";
import ExportButton from "../../components/ExportButton.jsx";
import { rollingNarrative } from "../../lib/interpret.js";

export default function RollingView({ data, state, ctx, series, pending }) {
  const { assetA, assetB, window, frequency, regime: regimeFilter, showBand } = state;
  const freq = FREQUENCIES[frequency];

  const result = useMemo(() => {
    const recomputed = rollingPair(series, assetA, assetB, window);
    const frozen = frozenRolling(data, { assetA, assetB, frequency, window });
    const status = rollingStatus(frozen, recomputed);
    return { values: status.status === "validated" ? frozen.values : recomputed, status };
  }, [data, series, assetA, assetB, window, frequency]);

  const bounds = useMemo(() => rangeIndices(series.dates, ctx.range), [series.dates, ctx.range]);
  const stats = useMemo(() => describeSeries(result.values, series.dates, bounds), [result.values, series.dates, bounds]);
  const highlight = regimeFilter !== "all" && frequency === "daily";

  const figure = useMemo(() => {
    if (!stats) return null;
    const [start, end] = bounds;
    const dates = series.dates.slice(start, end + 1);
    const values = result.values.slice(start, end + 1);
    const traces = [];
    if (showBand) {
      const { lo, hi } = fisherBand(values, window);
      traces.push(
        { x: dates, y: hi, type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
        { x: dates, y: lo, type: "scatter", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(212,175,90,0.16)", hoverinfo: "skip", showlegend: false },
      );
    }
    traces.push({
      x: dates,
      y: values,
      type: "scatter",
      mode: "lines",
      name: `${ASSET_LABELS[assetA]} vs ${ASSET_LABELS[assetB]}`,
      line: { color: GOLD, width: 1.7 },
      connectgaps: false,
      hovertemplate: `<b>%{x|%d %b %Y}</b><br>${ASSET_LABELS[assetA]} vs ${ASSET_LABELS[assetB]}<br>${window}-${freq.short} correlation: %{y:.3f}<extra></extra>`,
    });
    const shapes = highlight ? regimeShapes(regimeSegments(data.dates, ctx.regime.labels, [regimeFilter], ctx.idx)) : [];
    shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: "#45464c", width: 1 } });
    const annotations = [];
    if (data.meta.etf_era_start >= dates[0] && data.meta.etf_era_start <= dates[dates.length - 1]) {
      const m = etfMarker(data.meta.etf_era_start);
      shapes.push(m.shape);
      annotations.push(m.annotation);
    }
    return {
      traces,
      layout: baseLayout({
        shapes,
        annotations,
        hovermode: "x",
        showlegend: false,
        margin: { l: 56, r: 20, t: 40, b: 44 },
        // Keep the user's zoom while toggling overlays; reset it when the data selection changes.
        uirevision: `${assetA}|${assetB}|${frequency}|${window}|${ctx.range.start}|${ctx.range.end}`,
        yaxis: { ...baseLayout().yaxis, title: { text: "Rolling correlation (r)" }, range: [-1, 1], fixedrange: true },
        xaxis: { ...baseLayout().xaxis, ...CROSSHAIR, type: "date", rangeselector: RANGE_SELECTOR },
      }),
    };
  }, [stats, bounds, series.dates, result.values, showBand, window, assetA, assetB, highlight, data, ctx.regime.labels, ctx.idx, ctx.range, regimeFilter, frequency, freq.short]);

  const title = `${ASSET_LABELS[assetA]} vs ${ASSET_LABELS[assetB]} · ${window}-${freq.short} rolling correlation`;

  if (!stats || stats.n < 2) {
    const available = series.dates.length;
    return (
      <div className="explorer-body">
        <section className="chart-panel">
          <header className="chart-header">
            <h3>{title}</h3>
            <Badge kind="insufficient" />
          </header>
          <StatePanel kind="insufficient" title="Not enough observations for this window" height={460}>
            <p>
              A {window}-{freq.unit.replace(/s$/, "").replace(/ /g, "-")} window needs at least {window + 1} consecutive {freq.label.toLowerCase()} prices before
              its first value. The selected period ends before enough data accumulates
              {stats ? ` (only ${stats.n} window available)` : ""}. The full {freq.label.toLowerCase()} series has {available.toLocaleString()} observations.
            </p>
            <p>Shorten the window or lengthen the period{frequency === "daily" ? "" : ", or switch to daily returns"}.</p>
          </StatePanel>
        </section>
      </div>
    );
  }

  const reasons = [...result.status.reasons];
  if (showBand) reasons.push("Fisher-z band is an i.i.d. approximation, not a research artifact");
  const notes = [];
  if (regimeFilter !== "all" && frequency !== "daily") notes.push(`Regime highlighting is unavailable for weekly or monthly returns: ${T.vol} regimes are defined on daily observations only.`);
  if (highlight && !ctx.regime.isFrozen) reasons.push(`regime highlighting uses ${IS_PORTFOLIO ? "non-default" : "non-protocol"} ${T.vol} cutoffs`);

  // Scope: `seriesBadge` describes the plotted series; the period summary in the
  // interpretation panel is at most "derived" from it (never itself validated).
  const status = reasons.length ? "exploratory" : "validated";
  const interpretationStatus = summaryStatus(status);
  const etfInView = data.meta.etf_era_start >= stats.first.date && data.meta.etf_era_start <= stats.latest.date;
  let regimeDays = 0;
  if (highlight) for (let i = ctx.idx[0]; i <= ctx.idx[1]; i += 1) if (ctx.regime.labels[i] === regimeFilter) regimeDays += 1;
  const vol = IS_PORTFOLIO ? "Vol index" : "VIX";
  const cutoff = { Normal: `${vol} < ${num(ctx.regime.thresholds.p75, 2)}`, Elevated: `${vol} ${num(ctx.regime.thresholds.p75, 2)}–${num(ctx.regime.thresholds.p90, 2)}`, Severe: `${vol} > ${num(ctx.regime.thresholds.p90, 2)}` }[regimeFilter];
  const exportSpec = {
    title: `Rolling correlation: ${ASSET_LABELS[assetA]} vs ${ASSET_LABELS[assetB]}`,
    status: status === "validated" ? "Validated" : IS_PORTFOLIO ? "Synthetic demo" : "Exploratory",
    config: {
      "Asset A": assetCode(assetA),
      "Asset B": assetCode(assetB),
      Window: `${window} ${freq.unit}`,
      Frequency: `${freq.label} log returns`,
      Period: `${ctx.range.start} to ${ctx.range.end}`,
    },
    notes: [
      ...reasons.map((r) => `${IS_PORTFOLIO ? "Note" : "Exploratory because"}: ${r}`),
      ...(result.status.source ? [`Matches ${result.status.source}`] : []),
      "Pearson correlation of log returns over a trailing window; a value requires the full window (no interpolation).",
    ],
    columns: [
      { key: "date", label: "window_end_date" },
      { key: "r", label: "rolling_correlation" },
    ],
    rows: series.dates.slice(bounds[0], bounds[1] + 1).map((date, k) => ({ date, r: result.values[bounds[0] + k] })).filter((row) => row.r !== null),
  };
  const regimeSplit = highlight ? regimeSplitMean(result.values, ctx.regime.labels, rangeIndices(data.dates, ctx.range), regimeFilter) : null;

  const checks = [
    result.status.status === "validated"
      ? {
          label: "Rolling series",
          status: "validated",
          detail: `Matches ${result.status.source} on ${result.status.parity.n.toLocaleString()} points (max |Δ| ${result.status.parity.max.toExponential(1)}).`,
        }
      : { label: "Rolling series", status: "exploratory", detail: result.status.reasons[0] },
  ];
  if (showBand) checks.push({ label: "Fisher-z band", status: "exploratory", detail: "Assumes independent returns; daily returns are fat-tailed and clustered." });
  checks.push({
    label: "Period summary (average, range, latest, share positive)",
    status: interpretationStatus,
    detail: IS_PORTFOLIO
      ? `Calculated in the browser over ${stats.first.date} to ${stats.latest.date}.`
      : `Calculated in the browser over ${stats.first.date} to ${stats.latest.date}. Not a tabulated research statistic${
          interpretationStatus === "derived" ? ", though the underlying series is validated" : ""
        }.`,
  });

  return (
    <div className="explorer-body">
      <section className="chart-panel">
        <header className="chart-header">
          <h3>{title}</h3>
          <div className="chart-actions">
            <Badge kind={status}>{status === "validated" ? "Series validated" : undefined}</Badge>
            <ExportButton filename={`${IS_PORTFOLIO ? "synthetic_" : ""}rolling-correlation_${assetCode(assetA)}_${assetCode(assetB)}_${window}${freq.short}.csv`} spec={exportSpec} />
          </div>
        </header>
        <Plot data={figure.traces} layout={figure.layout} height={460} label={`${title}. ${stats.n} points from ${stats.first.date} to ${stats.latest.date}.`} />
        <ul className="chart-legend" aria-label="Chart legend">
          <li>
            <span className="legend-swatch legend-line" style={{ background: GOLD }} aria-hidden="true" />
            {ASSET_LABELS[assetA]} vs {ASSET_LABELS[assetB]}, {window}-{freq.unit.replace(/s$/, "").replace(/ /g, "-")} rolling correlation
          </li>
          {showBand && (
            <li>
              <span className="legend-swatch legend-area" style={{ background: "rgba(212,175,90,0.35)" }} aria-hidden="true" />
              Fisher-z 95% band (approximation)
            </li>
          )}
          {highlight && (
            <li>
              <span
                className="legend-swatch legend-area"
                style={{ background: REGIME_FILLS[regimeFilter] ?? "rgba(125,135,150,0.25)", borderColor: REGIME_COLORS[regimeFilter] }}
                aria-hidden="true"
              />
              Shaded: {T.regimeDays(regimeFilter)} ({cutoff}, {ctx.regime.isFrozen ? (IS_PORTFOLIO ? "default cutoffs" : "protocol cutoffs") : "custom cutoffs"}); {regimeDays.toLocaleString()} days in the selected period
            </li>
          )}
          {etfInView && (
            <li>
              <span className="legend-swatch legend-dotted" aria-hidden="true" />
              {IS_PORTFOLIO ? "Demo split date" : "U.S. spot-Bitcoin ETF trading begins"} ({longDate(data.meta.etf_era_start)})
            </li>
          )}
        </ul>
        <p className="chart-note">Drag to zoom, use the range buttons, or double-click to reset. Zooming changes the view only; statistics use the selected period.</p>
        {notes.map((n) => (
          <p key={n} className="chart-note">
            {n}
          </p>
        ))}
      </section>
      <Interpretation
        pending={pending}
        statusLabel={interpretationStatus === "derived" ? "Derived from validated series" : undefined}
        about={`How the correlation between ${ASSET_LABELS[assetA]} and ${ASSET_LABELS[assetB]} changes over time. Each point uses the trailing ${window} ${freq.unit} of returns.`}
        limitations={[
          "Consecutive points share most of their window, so they are strongly autocorrelated.",
          "Correlation captures linear co-movement only and says nothing about causation.",
        ]}
        status={interpretationStatus}
        reasons={reasons}
        narrative={rollingNarrative({ assetA, assetB, window, unit: freq.unit, stats, regimeSplit, regime: regimeFilter })}
        facts={[
          { label: "Window", value: `${window} ${freq.unit}` },
          { label: "Frequency", value: `${freq.label} log returns` },
          { label: "First window ends", value: stats.first.date },
          { label: "Last window ends", value: stats.latest.date },
          { label: "Rolling points", value: stats.n.toLocaleString() },
          { label: "Observations per point", value: window.toLocaleString() },
        ]}
        checks={checks}
        methodology={[
          `Pearson correlation of ${freq.label.toLowerCase()} log returns ln(Pₜ/Pₜ₋₁) over a trailing ${window}-${freq.unit.replace(/s$/, "")} window; a value is reported only when the full window is available.`,
          frequency === "daily"
            ? IS_PORTFOLIO
              ? "Synthetic weekday calendar shared by all six series; there are no gaps to align or interpolate."
              : "Common trading calendar: Bitcoin is aligned to ETF trading days; no ETF prices are interpolated."
            : `${freq.label} returns use the last common-calendar price in each ${frequency === "weekly" ? "week" : "month"}${IS_PORTFOLIO ? "." : "; this resample is not part of the protocol."}`,
          "Values are computed over the full history and then clipped to the selected period.",
        ]}
      />
    </div>
  );
}
