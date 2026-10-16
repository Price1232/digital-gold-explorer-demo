import { useMemo } from "react";
import Plot from "../../components/Plot.jsx";
import Badge from "../../components/Badge.jsx";
import StatePanel from "../../components/States.jsx";
import Interpretation from "../../components/Interpretation.jsx";
import { ASSET_LABELS, assetCode } from "../../lib/data.js";
import { IS_PORTFOLIO, T } from "../../lib/edition.js";
import { MIN_OBS, pairSample } from "../../lib/analysis.js";
import { scatterNarrative } from "../../lib/interpret.js";
import { REGIMES } from "../../lib/regimes.js";
import { assess, betaArtifact, configFor, correlationArtifact, regimeUnavailable } from "../../lib/research.js";
import { FREQUENCIES } from "../../lib/returns.js";
import { fisherCI, regression } from "../../lib/stats.js";
import { CROSSHAIR, GOLD, REGIME_COLORS, baseLayout } from "../../lib/theme.js";
import { longDate, num } from "../../lib/format.js";
import ExportButton from "../../components/ExportButton.jsx";

export function RegimeUnavailable({ state, height = 480 }) {
  return (
    <StatePanel kind="unavailable" title="Regime filter unavailable at this frequency" height={height}>
      <p>
        {IS_PORTFOLIO
          ? "Vol-index regimes are defined on daily observations. There is no rule for"
          : "VIX regimes are defined on daily observations. There is no rule for"}{" "}
        classifying a {FREQUENCIES[state.frequency].label.toLowerCase()} return as Normal, Elevated or Severe, so a{" "}
        {state.regime.toLowerCase()}-regime sample cannot be formed without inventing one.
      </p>
      <p>Switch the return frequency to Daily, or set the market regime to All days.</p>
    </StatePanel>
  );
}

export default function ScatterView({ data, state, ctx, series, pending }) {
  const { assetA, assetB, frequency, regime, showFit } = state;
  const freq = FREQUENCIES[frequency];
  const unavailable = regimeUnavailable(state);

  const sample = useMemo(
    () => (unavailable ? null : pairSample(series, assetA, assetB, ctx.range, { labels: frequency === "daily" ? ctx.regime.labels : null, regime })),
    [unavailable, series, assetA, assetB, ctx.range, frequency, ctx.regime.labels, regime],
  );
  const fit = useMemo(() => (sample ? regression(sample.xs, sample.ys) : null), [sample]);

  const figure = useMemo(() => {
    if (!sample || sample.xs.length < MIN_OBS) return null;
    const colourByRegime = frequency === "daily" && regime === "all";
    const groups = colourByRegime ? [...REGIMES, null] : ["all"];
    const traces = groups.map((g) => {
      const idx = sample.xs.map((_, i) => i).filter((i) => g === "all" || sample.regimes[i] === g);
      return {
        x: idx.map((i) => sample.xs[i] * 100),
        y: idx.map((i) => sample.ys[i] * 100),
        customdata: idx.map((i) => longDate(sample.dates[i])),
        type: "scatter", // SVG; scattergl is not in the cartesian bundle and ~2,925 points render fine
        mode: "markers",
        name: g === "all" ? (regime === "all" ? "Observations" : `${regime} ${T.vol}`) : g ?? `${T.vol} unavailable`,
        marker: {
          color: g === "all" ? GOLD : g ? REGIME_COLORS[g] : "#5b5d63",
          size: g === "Severe" ? 6 : 4.5,
          opacity: g === "Normal" ? 0.45 : 0.8,
        },
        hovertemplate: `<b>%{customdata}</b><br>${ASSET_LABELS[assetB]}: %{x:.2f}%<br>${ASSET_LABELS[assetA]}: %{y:.2f}%<extra>${g === "all" ? "" : g ?? `${T.vol} unavailable`}</extra>`,
      };
    }).filter((t) => t.x.length);
    if (showFit && Number.isFinite(fit.beta)) {
      const lo = Math.min(...sample.xs);
      const hi = Math.max(...sample.xs);
      traces.push({
        x: [lo * 100, hi * 100],
        y: [(fit.alpha + fit.beta * lo) * 100, (fit.alpha + fit.beta * hi) * 100],
        type: "scatter",
        mode: "lines",
        name: `OLS fit (β ${fit.beta.toFixed(2)})`,
        line: { color: "#f1ede4", width: 1.6, dash: "dash" },
        hoverinfo: "skip",
      });
    }
    return {
      traces,
      layout: baseLayout({
        hovermode: "closest",
        uirevision: `${assetA}|${assetB}|${frequency}|${regime}|${ctx.range.start}|${ctx.range.end}`,
        legend: { ...baseLayout().legend, title: { text: frequency === "daily" && regime === "all" ? T.volRegime : "" } },
        xaxis: { ...baseLayout().xaxis, ...CROSSHAIR, title: { text: `${ASSET_LABELS[assetB]} ${freq.label.toLowerCase()} log return (%)` }, zeroline: true },
        yaxis: { ...baseLayout().yaxis, ...CROSSHAIR, title: { text: `${ASSET_LABELS[assetA]} ${freq.label.toLowerCase()} log return (%)` }, zeroline: true },
      }),
    };
  }, [sample, fit, frequency, regime, showFit, assetA, assetB, freq.label, ctx.range]);

  const title = `${ASSET_LABELS[assetA]} vs ${ASSET_LABELS[assetB]} · ${freq.label.toLowerCase()} returns${regime === "all" ? "" : ` · ${regime} ${T.vol} days`}`;

  if (unavailable) {
    return (
      <div className="explorer-body">
        <section className="chart-panel">
          <header className="chart-header">
            <h3>{title}</h3>
            <Badge kind="unavailable" />
          </header>
          <RegimeUnavailable state={state} />
        </section>
      </div>
    );
  }

  if (sample.xs.length < MIN_OBS) {
    return (
      <div className="explorer-body">
        <section className="chart-panel">
          <header className="chart-header">
            <h3>{title}</h3>
            <Badge kind="insufficient" />
          </header>
          <StatePanel kind="insufficient" title="Too few paired observations" height={480}>
            <p>
              The selected period and regime contain {sample.xs.length.toLocaleString()} paired {freq.label.toLowerCase()} returns. At least{" "}
              {MIN_OBS} are required before a correlation is reported.
            </p>
            <p>
              Widen the period{regime === "all" ? "" : " or choose All days"}
              {frequency === "daily" ? "" : ", or switch to daily returns"}.
            </p>
          </StatePanel>
        </section>
      </div>
    );
  }

  const cfg = configFor(state, ctx.regime.isFrozen);
  const corr = assess(correlationArtifact(data.tables, cfg), fit.r);
  const beta = assess(betaArtifact(data.tables, cfg), fit.beta);
  const ci = fisherCI(fit.r, fit.n);
  // Headline statistics are correlation and beta; the Fisher interval is always an approximation.
  const status = corr.status === "validated" ? (beta.status === "validated" ? "validated" : "partial") : "exploratory";
  const reasons = [...corr.reasons.map((r) => `Correlation: ${r}`), ...beta.reasons.map((r) => `Beta: ${r}`)];
  const exportSpec = {
    title: `${freq.label} returns: ${ASSET_LABELS[assetA]} vs ${ASSET_LABELS[assetB]}`,
    status: { validated: "Validated", partial: "Partly validated", exploratory: IS_PORTFOLIO ? "Synthetic demo" : "Exploratory" }[status],
    config: {
      "Asset A (y)": assetCode(assetA),
      "Asset B (x)": assetCode(assetB),
      Frequency: `${freq.label} log returns`,
      Period: `${ctx.range.start} to ${ctx.range.end}`,
      Regime: regime === "all" ? "All days" : `${regime} ${T.vol} days`,
      [T.volCutoffs]: `elevated >= ${num(ctx.regime.thresholds.p75, 3)}, severe > ${num(ctx.regime.thresholds.p90, 3)}`,
      Correlation: num(fit.r, 6),
      "Beta (A on B)": num(fit.beta, 6),
      Observations: fit.n,
    },
    notes: [...reasons.map((r) => `${IS_PORTFOLIO ? "Note" : "Exploratory because"}: ${r}`), ...[corr.source, beta.source].filter(Boolean).map((src) => `Matches ${src}`)],
    columns: [
      { key: "date", label: "date" },
      { key: "a", label: `${assetCode(assetA)}_log_return` },
      { key: "b", label: `${assetCode(assetB)}_log_return` },
      { key: "regime", label: IS_PORTFOLIO ? "vol_index_regime" : "vix_regime" },
    ],
    rows: sample.dates.map((date, i) => ({ date, a: sample.ys[i], b: sample.xs[i], regime: sample.regimes[i] ?? "" })),
  };
  const check = (label, a) => ({
    label,
    status: a.status,
    detail: a.status === "validated" ? `Matches ${a.source} (${num(a.artifactValue, 4)}).` : a.reasons[0],
  });

  return (
    <div className="explorer-body">
      <section className="chart-panel">
        <header className="chart-header">
          <h3>{title}</h3>
          <div className="chart-actions">
            <Badge kind={status} />
            <ExportButton filename={`${IS_PORTFOLIO ? "synthetic_" : ""}returns_${assetCode(assetA)}_${assetCode(assetB)}_${frequency}.csv`} spec={exportSpec} />
          </div>
        </header>
        <Plot data={figure.traces} layout={figure.layout} height={480} label={`${title}. ${fit.n} observations, correlation ${num(fit.r, 2)}.`} />
        <p className="chart-note">
          {frequency === "daily" && regime === "all" ? "Click a legend entry to hide or show a regime (display only; statistics use every point). " : ""}
          Drag to zoom; double-click to reset.
        </p>
      </section>
      <Interpretation
        pending={pending}
        about={`Each point is one ${freq.label.toLowerCase()} observation: ${ASSET_LABELS[assetB]} return on the horizontal axis, ${ASSET_LABELS[assetA]} on the vertical. A tighter upward cloud means stronger co-movement.`}
        limitations={[
          IS_PORTFOLIO
            ? "A few extreme days can move the correlation and beta noticeably; outliers are kept."
            : "A few extreme days can move the correlation and beta noticeably; outliers are kept, as the protocol requires.",
          "Correlation and beta describe co-movement in this sample, not causation or future behaviour.",
        ]}
        status={status}
        reasons={reasons}
        narrative={scatterNarrative({ assetA, assetB, fit, ci, frequencyLabel: freq.label })}
        facts={[
          { label: "Sample", value: `${sample.dates[0]} → ${sample.dates[sample.dates.length - 1]}` },
          { label: "Observations", value: fit.n.toLocaleString() },
          { label: "Correlation", value: num(fit.r, 3) },
          { label: "Approx. 95% CI", value: ci ? `${num(ci[0], 2)} to ${num(ci[1], 2)}` : "—" },
          { label: `Beta (${assetA} on ${assetB})`, value: num(fit.beta, 3) },
          { label: "R²", value: num(fit.r2, 3) },
        ]}
        checks={[
          check("Correlation", corr),
          check("Beta", beta),
          {
            label: "Confidence interval",
            status: "exploratory",
            detail: IS_PORTFOLIO
              ? "Fisher-z approximation assuming independent returns."
              : "Fisher-z approximation assuming independent returns. The engine's block-bootstrap intervals are on the Stress regimes page.",
          },
        ]}
        methodology={[
          `Each point is one ${freq.label.toLowerCase()} log return pair on the common trading calendar; no prices are interpolated.`,
          regime === "all"
            ? `Points are coloured by ${IS_PORTFOLIO ? "vol-index regime" : "VIX regime"} using the cutoffs in Advanced settings.`
            : `Only ${T.regimeDays(regime)} are included (${IS_PORTFOLIO ? "vol index" : "VIX"} ${regime === "Normal" ? `< ${num(ctx.regime.thresholds.p75, 2)}` : regime === "Elevated" ? `${num(ctx.regime.thresholds.p75, 2)}–${num(ctx.regime.thresholds.p90, 2)}` : `> ${num(ctx.regime.thresholds.p90, 2)}`}).`,
          "Beta is the OLS slope of asset A on asset B: Cov(A, B) / Var(B).",
        ]}
      />
    </div>
  );
}
