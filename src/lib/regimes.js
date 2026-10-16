import { quantile, isNum } from "./stats.js";

export const REGIMES = ["Normal", "Elevated", "Severe"];

/**
 * VIX cutoffs at the given percentiles. The frozen protocol uses the 75th/90th
 * percentiles of VIX over the full sample of *return* dates, i.e. excluding the
 * first price date.
 * `basis: "range"` recomputes them inside the selected window (exploratory).
 */
export function vixThresholds(vix, [startIdx, endIdx], { p75, p90, basis }) {
  const values = basis === "range" ? vix.slice(Math.max(1, startIdx), endIdx + 1) : vix.slice(1);
  return { p75: quantile(values, p75 / 100), p90: quantile(values, p90 / 100) };
}

/** Regime label per day — null where the index value is missing. */
export function classifyVix(vix, t) {
  return vix.map((v) => {
    if (!isNum(v)) return null;
    if (v < t.p75) return "Normal";
    if (v <= t.p90) return "Elevated";
    return "Severe";
  });
}

/**
 * Contiguous same-label runs whose label is in `targets`, clipped to the index
 * range. Each run extends to the next trading date so single days stay visible.
 */
export function regimeSegments(dates, labels, targets, [startIdx, endIdx]) {
  const segments = [];
  let open = null;
  const close = (last) => {
    segments.push({ x0: dates[open], x1: dates[Math.min(last + 1, endIdx)], label: labels[open] });
    open = null;
  };
  for (let i = startIdx; i <= endIdx; i += 1) {
    const label = targets.includes(labels[i]) ? labels[i] : null;
    if (open !== null && label !== labels[open]) close(i - 1);
    if (label && open === null) open = i;
  }
  if (open !== null) close(endIdx);
  return segments;
}
