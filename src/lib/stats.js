// Statistical helpers (correlation, OLS beta, quantiles, CAGR, drawdown).
// Missing observations are `null`.

const Z_95 = 1.959963984540054;

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(v);

/** ln(P_t / P_{t-1}); first element is null (matches pandas shift(1)). */
export function logReturns(prices) {
  const out = new Array(prices.length).fill(null);
  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1];
    const cur = prices[i];
    if (isNum(prev) && isNum(cur) && prev > 0 && cur > 0) out[i] = Math.log(cur / prev);
  }
  return out;
}

/** Sample moments over a window ending at `end` (inclusive); null if any value is missing. */
function windowMoments(x, y, end, w) {
  const start = end - w + 1;
  let sx = 0;
  let sy = 0;
  for (let j = start; j <= end; j += 1) {
    if (!isNum(x[j]) || !isNum(y[j])) return null;
    sx += x[j];
    sy += y[j];
  }
  const mx = sx / w;
  const my = sy / w;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let j = start; j <= end; j += 1) {
    const dx = x[j] - mx;
    const dy = y[j] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return { sxx, syy, sxy };
}

/** pandas `x.rolling(w).corr(y)`: full window required (min_periods = w). */
export function rollingCorrelation(x, y, w) {
  const out = new Array(x.length).fill(null);
  for (let i = w - 1; i < x.length; i += 1) {
    const m = windowMoments(x, y, i, w);
    if (m && m.sxx > 0 && m.syy > 0) out[i] = m.sxy / Math.sqrt(m.sxx * m.syy);
  }
  return out;
}

/** Rolling OLS beta of x on benchmark y: Cov(x, y) / Var(y). */
export function rollingBeta(x, y, w) {
  const out = new Array(x.length).fill(null);
  for (let i = w - 1; i < x.length; i += 1) {
    const m = windowMoments(x, y, i, w);
    if (m && m.syy > 0) out[i] = m.sxy / m.syy;
  }
  return out;
}

/** Pearson correlation, OLS beta/intercept of y on x, and R² for paired samples. */
export function regression(xs, ys) {
  const n = xs.length;
  if (n < 3) return { n, r: null, beta: null, alpha: null, r2: null };
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  const beta = sxx > 0 ? sxy / sxx : null;
  return { n, r, beta, alpha: beta === null ? null : my - beta * mx, r2: r === null ? null : r * r };
}

/** Fisher-z 95% interval for a correlation. Assumes i.i.d. observations. */
export function fisherCI(r, n) {
  if (!isNum(r) || n <= 3 || Math.abs(r) >= 1) return null;
  const z = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - Z_95 * se), Math.tanh(z + Z_95 * se)];
}

/** Fisher-z band for a rolling correlation series with constant window n. */
export function fisherBand(series, n) {
  const cis = series.map((r) => fisherCI(r, n));
  return { lo: cis.map((ci) => (ci ? ci[0] : null)), hi: cis.map((ci) => (ci ? ci[1] : null)) };
}

/** pandas default (linear interpolation) quantile over non-null values. */
export function quantile(values, q) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

/** Largest absolute difference where both series are defined. */
export function maxAbsDiff(a, b) {
  let max = 0;
  let n = 0;
  let mismatched = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = isNum(a[i]);
    const bv = isNum(b[i]);
    if (av && bv) {
      max = Math.max(max, Math.abs(a[i] - b[i]));
      n += 1;
    } else if (av !== bv) {
      mismatched += 1;
    }
  }
  return { max, n, mismatched };
}

/** CAGR using elapsed calendar days / 365.25. */
export function cagr(prices, dates) {
  const idx = prices.map((p, i) => (isNum(p) ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return null;
  const first = idx[0];
  const last = idx[idx.length - 1];
  const days = (Date.parse(dates[last]) - Date.parse(dates[first])) / 86400000;
  return (prices[last] / prices[first]) ** (365.25 / days) - 1;
}

/** Minimum of price / running peak - 1. */
export function maxDrawdown(prices) {
  let peak = -Infinity;
  let worst = 0;
  for (const p of prices) {
    if (!isNum(p)) continue;
    peak = Math.max(peak, p);
    worst = Math.min(worst, p / peak - 1);
  }
  return worst;
}

export function summarize(series) {
  const v = series.filter(isNum);
  if (!v.length) return null;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  return { latest: v[v.length - 1], mean, min: Math.min(...v), max: Math.max(...v), n: v.length };
}

export { isNum };
