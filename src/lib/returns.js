import { logReturns } from "./stats.js";

// Return frequencies. Daily log returns on the common ETF calendar are the
// default definition; weekly and monthly returns
// are exploratory resamples of the same validated prices.
export const FREQUENCIES = {
  daily: { label: "Daily", unit: "trading days", short: "d" },
  weekly: { label: "Weekly", unit: "weeks", short: "w" },
  monthly: { label: "Monthly", unit: "months", short: "m" },
};

function bucket(date, frequency) {
  if (frequency === "monthly") return date.slice(0, 7);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday of the ISO week
  return d.toISOString().slice(0, 10);
}

/**
 * Log-return series at the requested frequency. Weekly/monthly use the last
 * common-calendar price in each week/month; no prices are interpolated.
 * `indices[k]` maps observation k back to the daily calendar (for VIX lookups).
 */
export function buildSeries(dates, prices, assets, frequency) {
  let indices = dates.map((_, i) => i);
  if (frequency !== "daily") {
    indices = indices.filter((i) => i === dates.length - 1 || bucket(dates[i], frequency) !== bucket(dates[i + 1], frequency));
  }
  return {
    frequency,
    dates: indices.map((i) => dates[i]),
    indices,
    returns: Object.fromEntries(assets.map((a) => [a, logReturns(indices.map((i) => prices[a][i]))])),
  };
}
