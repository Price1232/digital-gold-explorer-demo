// Analysis periods. Full sample and the pre/post spot-ETF split are the
// windows defined in advance; custom ranges are exploratory.

import { T } from "./edition.js";

export const PERIODS = [
  { id: "full", label: "Full sample" },
  { id: "pre_etf", label: T.preSplit },
  { id: "etf", label: T.postSplit },
  { id: "custom", label: "Custom range" },
];

function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** ISO date range for a period id. */
export function periodRange(meta, period, customRange) {
  switch (period) {
    case "pre_etf":
      return { start: meta.sample_start, end: dayBefore(meta.etf_era_start) };
    case "etf":
      return { start: meta.etf_era_start, end: meta.sample_end };
    case "custom":
      return customRange;
    default:
      return { start: meta.sample_start, end: meta.sample_end };
  }
}

/** Index bounds [startIdx, endIdx] of the dates inside an ISO date range. */
export function rangeIndices(dates, range) {
  let start = dates.findIndex((d) => d >= range.start);
  if (start < 0) start = dates.length - 1;
  let end = dates.length - 1;
  while (end > 0 && dates[end] > range.end) end -= 1;
  return [start, Math.max(start, end)];
}
