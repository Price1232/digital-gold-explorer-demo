// Shareable URLs: encode the supported analysis parameters in the query
// string and decode them defensively (invalid values fall back to defaults).

import { assetCode, assetFromCode } from "./data.js";
import { IS_PORTFOLIO } from "./edition.js";
import { WINDOW_OPTIONS } from "./explorerState.js";
import { PERIODS } from "./periods.js";

// The portfolio edition has no overview page, so it does not accept that id.
export const PAGES = [...(IS_PORTFOLIO ? [] : ["overview"]), "explorer", "beta", "stress", "etf", "integrity", "about"];
export const TABS = ["rolling", "scatter", "matrix"];
const REGIMES = ["all", "Normal", "Elevated", "Severe"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Query string holding only the parameters that differ from `defaults`. */
export function encodeState(state, defaults) {
  const p = new URLSearchParams();
  const put = (key, value, base) => {
    if (value !== base) p.set(key, String(value));
  };
  put("page", state.page, defaults.page);
  put("tab", state.tab, defaults.tab);
  put("a", assetCode(state.assetA), assetCode(defaults.assetA));
  put("b", assetCode(state.assetB), assetCode(defaults.assetB));
  put("period", state.period, defaults.period);
  if (state.period === "custom") {
    p.set("from", state.customRange.start);
    p.set("to", state.customRange.end);
  }
  put("regime", state.regime, defaults.regime);
  put("freq", state.frequency, defaults.frequency);
  put("w", state.window, defaults.window);
  put("band", state.showBand ? 1 : 0, defaults.showBand ? 1 : 0);
  put("fit", state.showFit ? 1 : 0, defaults.showFit ? 1 : 0);
  put("p75", state.thresholds.p75, defaults.thresholds.p75);
  put("p90", state.thresholds.p90, defaults.thresholds.p90);
  put("basis", state.thresholds.basis, defaults.thresholds.basis);
  return p.toString();
}

/** Merge valid URL parameters into `defaults`; anything invalid is ignored. */
export function decodeState(search, defaults, { meta, assets }) {
  const p = new URLSearchParams(search);
  const s = structuredClone(defaults);
  const pick = (key, allowed) => (allowed.includes(p.get(key)) ? p.get(key) : null);

  s.page = pick("page", PAGES) ?? s.page;
  s.tab = pick("tab", TABS) ?? s.tab;
  // URLs carry display codes (the tickers in the research edition).
  const a = pick("a", assets.map(assetCode)) && assetFromCode(p.get("a"));
  const b = pick("b", assets.map(assetCode)) && assetFromCode(p.get("b"));
  if (a && b && a !== b) Object.assign(s, { assetA: a, assetB: b });
  else if (a && a !== s.assetB) s.assetA = a;
  else if (b && b !== s.assetA) s.assetB = b;

  const period = pick("period", PERIODS.map((x) => x.id));
  if (period === "custom") {
    const from = p.get("from");
    const to = p.get("to");
    if (ISO.test(from ?? "") && ISO.test(to ?? "") && from <= to && from >= meta.sample_start && to <= meta.sample_end) {
      s.period = "custom";
      s.customRange = { start: from, end: to };
    }
  } else if (period) {
    s.period = period;
  }

  s.regime = pick("regime", REGIMES) ?? s.regime;
  const freq = pick("freq", Object.keys(WINDOW_OPTIONS));
  if (freq) {
    s.frequency = freq;
    s.window = WINDOW_OPTIONS[freq].fallback;
  }
  const w = Number(p.get("w"));
  const bounds = WINDOW_OPTIONS[s.frequency];
  if (p.has("w") && Number.isInteger(w) && w >= bounds.min && w <= bounds.max) s.window = w;
  if (p.has("band")) s.showBand = p.get("band") === "1";
  if (p.has("fit")) s.showFit = p.get("fit") === "1";

  const p75 = p.has("p75") ? Number(p.get("p75")) : s.thresholds.p75;
  const p90 = p.has("p90") ? Number(p.get("p90")) : s.thresholds.p90;
  if (Number.isInteger(p75) && Number.isInteger(p90) && p75 >= 50 && p90 <= 99 && p90 > p75) s.thresholds = { ...s.thresholds, p75, p90 };
  const basis = pick("basis", ["full", "range"]);
  if (basis) s.thresholds = { ...s.thresholds, basis };
  // Links made before the overview page existed carry explorer settings but no
  // page; when they set a valid analysis they still open the explorer.
  if (!p.has("page") && s.page === "overview" && JSON.stringify({ ...s, page: null }) !== JSON.stringify({ ...defaults, page: null })) s.page = "explorer";
  return s;
}
