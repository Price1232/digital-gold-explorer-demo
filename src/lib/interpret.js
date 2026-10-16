// Plain-English descriptions generated only from computed statistics.

import { IS_PORTFOLIO, T } from "./edition.js";

const RESEARCH_NAMES = {
  "BTC-USD": "Bitcoin",
  GLD: "gold (GLD)",
  SPY: "the S&P 500 (SPY)",
  QQQ: "the Nasdaq-100 (QQQ)",
  TLT: "long Treasuries (TLT)",
  IEF: "intermediate Treasuries (IEF)",
};

const PORTFOLIO_NAMES = {
  "BTC-USD": "the synthetic crypto series",
  GLD: "the synthetic gold series",
  SPY: "the synthetic equity series",
  QQQ: "the synthetic tech series",
  TLT: "the synthetic long-bond series",
  IEF: "the synthetic mid-bond series",
};

const NAMES = IS_PORTFOLIO ? PORTFOLIO_NAMES : RESEARCH_NAMES;

export const assetName = (a) => NAMES[a] ?? a;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const f2 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(2));

/** Conventional strength bands for |r|, applied to the value as displayed (2 dp). */
export function strength(r) {
  const a = Math.round(Math.abs(r) * 100) / 100;
  if (a < 0.1) return "negligible";
  if (a < 0.3) return "weak";
  if (a < 0.5) return "moderate";
  if (a < 0.7) return "strong";
  return "very strong";
}

export function describeCorrelation(r) {
  if (r === null || r === undefined || !Number.isFinite(r)) return "undefined";
  const s = strength(r);
  return s === "negligible" ? "negligible" : `${s} ${r > 0 ? "positive" : "negative"}`;
}

export function rollingNarrative({ assetA, assetB, window, unit, stats, regimeSplit, regime }) {
  const singular = unit.replace(/s$/, "").replace(/ /g, "-");
  const lines = [
    `Across ${stats.n.toLocaleString()} rolling ${window}-${singular} windows in the selected period, the correlation between ${assetName(assetA)} and ${assetName(assetB)} averaged ${f2(stats.mean)} (${describeCorrelation(stats.mean)}).`,
    `It ranged from ${f2(stats.min.value)} (${stats.min.date}) to ${f2(stats.max.value)} (${stats.max.date}) and was positive in ${Math.round(stats.positiveShare * 100)}% of windows. The latest value is ${f2(stats.latest.value)} on ${stats.latest.date}.`,
  ];
  if (regimeSplit && regimeSplit.nInside && regimeSplit.nOutside) {
    lines.push(
      `On ${T.regimeDays(regime)} the rolling correlation averaged ${f2(regimeSplit.inside)} (${regimeSplit.nInside.toLocaleString()} days) versus ${f2(regimeSplit.outside)} on other days. Rolling windows overlap, so this is a descriptive comparison, not an independent test.`,
    );
  }
  return lines;
}

export function scatterNarrative({ assetA, assetB, fit, ci, frequencyLabel }) {
  const lines = [
    `${cap(assetName(assetA))} and ${assetName(assetB)} show a ${describeCorrelation(fit.r)} relationship in ${frequencyLabel.toLowerCase()} returns: correlation ${f2(fit.r)}${ci ? ` (approximate 95% interval ${f2(ci[0])} to ${f2(ci[1])})` : ""}.`,
  ];
  if (Number.isFinite(fit.beta)) {
    lines.push(
      `On average, a 1% move in ${assetName(assetB)} coincided with a ${f2(fit.beta)}% move in ${assetName(assetA)} (OLS beta), and ${assetName(assetB)} accounts for ${Math.round((fit.r2 ?? 0) * 100)}% of the variance in ${assetName(assetA)} (R²).`,
    );
  }
  lines.push("Correlation describes co-movement only; it does not show that one asset drives the other.");
  return lines;
}

export function matrixNarrative({ matrix, focus }) {
  const valid = matrix.cells.filter((c) => Number.isFinite(c.r));
  if (!valid.length) return [];
  const hi = valid.reduce((m, c) => (c.r > m.r ? c : m));
  const lo = valid.reduce((m, c) => (c.r < m.r ? c : m));
  const lines = [
    `Strongest positive pair: ${assetName(hi.a)} and ${assetName(hi.b)} at ${f2(hi.r)}. Most negative pair: ${assetName(lo.a)} and ${assetName(lo.b)} at ${f2(lo.r)}.`,
  ];
  const focusCells = valid.filter((c) => c.a === focus || c.b === focus).sort((x, y) => y.r - x.r);
  if (focusCells.length) {
    const parts = focusCells.map((c) => `${c.a === focus ? c.b : c.a} ${f2(c.r)}`);
    lines.push(`${cap(assetName(focus))} correlations, highest to lowest: ${parts.join(", ")}.`);
  }
  return lines;
}
