// Pair-level computations for the explorer, built on the engine-equivalent
// helpers in stats.js. All inputs are validated prices; nothing is synthesised.

import { PORTFOLIO_CODES } from "./data.js";
import { IS_PORTFOLIO } from "./edition.js";
import { rangeIndices } from "./periods.js";
import { isNum, regression, rollingCorrelation } from "./stats.js";

/** Minimum paired observations before a correlation is reported. */
export const MIN_OBS = 30;

/**
 * Paired returns (y = asset A, x = asset B) inside the period, optionally
 * restricted to one VIX regime. Regime filtering needs daily observations.
 */
export function pairSample(series, assetA, assetB, range, { labels = null, regime = "all" } = {}) {
  const [start, end] = rangeIndices(series.dates, range);
  const y = series.returns[assetA];
  const x = series.returns[assetB];
  const out = { xs: [], ys: [], dates: [], regimes: [] };
  for (let i = start; i <= end; i += 1) {
    if (!isNum(x[i]) || !isNum(y[i])) continue;
    const label = labels ? labels[series.indices[i]] : null;
    if (regime !== "all" && label !== regime) continue;
    out.xs.push(x[i]);
    out.ys.push(y[i]);
    out.dates.push(series.dates[i]);
    out.regimes.push(label);
  }
  return out;
}

/** Correlation matrix over a common sample; each cell keeps its own n. */
export function correlationMatrix(series, assets, range, options) {
  const cells = {};
  for (const a of assets) {
    for (const b of assets) {
      if (a === b) continue;
      const key = [a, b].sort().join("|");
      if (!cells[key]) {
        const sample = pairSample(series, a, b, range, options);
        const fit = regression(sample.xs, sample.ys);
        cells[key] = { a, b, r: fit.r, n: fit.n, first: sample.dates[0], last: sample.dates[sample.dates.length - 1] };
      }
    }
  }
  const get = (a, b) => (a === b ? { a, b, r: 1, n: null } : cells[[a, b].sort().join("|")]);
  return { assets, cells: Object.values(cells), get };
}

/** Rolling correlation for any pair on the chosen series. */
export function rollingPair(series, assetA, assetB, window) {
  return rollingCorrelation(series.returns[assetA], series.returns[assetB], window);
}

/** Descriptive summary of a dated series inside the index range. */
export function describeSeries(values, dates, [start, end]) {
  let n = 0;
  let sum = 0;
  let min = null;
  let max = null;
  let first = null;
  let latest = null;
  let positive = 0;
  for (let i = start; i <= end; i += 1) {
    const v = values[i];
    if (!isNum(v)) continue;
    n += 1;
    sum += v;
    if (v > 0) positive += 1;
    if (!min || v < min.value) min = { value: v, date: dates[i] };
    if (!max || v > max.value) max = { value: v, date: dates[i] };
    if (!first) first = { value: v, date: dates[i] };
    latest = { value: v, date: dates[i] };
  }
  if (!n) return null;
  return { n, mean: sum / n, min, max, first, latest, positiveShare: positive / n };
}

/** Mean of a series on dates inside vs outside a regime (daily only). */
export function regimeSplitMean(values, labels, [start, end], regime) {
  const inside = [];
  const outside = [];
  for (let i = start; i <= end; i += 1) {
    if (!isNum(values[i]) || !labels[i]) continue;
    (labels[i] === regime ? inside : outside).push(values[i]);
  }
  const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
  return { inside: mean(inside), nInside: inside.length, outside: mean(outside), nOutside: outside.length };
}

/** Short axis label for an asset in the matrix. */
export const assetTick = (asset) => (IS_PORTFOLIO ? PORTFOLIO_CODES[asset] : asset === "BTC-USD" ? "BTC" : asset);

/** Asset pair for a clicked matrix cell (row = A, column = B); null on the diagonal. */
export function cellToPair(point, assets) {
  const a = assets.find((x) => assetTick(x) === point?.y);
  const b = assets.find((x) => assetTick(x) === point?.x);
  return a && b && a !== b ? { a, b } : null;
}
