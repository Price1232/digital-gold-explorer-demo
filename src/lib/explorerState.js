// Explorer selection state as a pure reducer, so tab switches preserve
// selections and every transition is unit-testable.

import { IS_PORTFOLIO, T } from "./edition.js";

export const WINDOW_OPTIONS = {
  daily: { options: [30, 90, 252], fallback: 90, min: 10, max: 504 },
  weekly: { options: [13, 26, 52], fallback: 26, min: 4, max: 156 },
  monthly: { options: [6, 12, 24], fallback: 12, min: 3, max: 60 },
};

/** Windows that exist as frozen research artifacts (daily only). */
export const FROZEN_WINDOWS = [30, 90, 252];

export const PROTOCOL_THRESHOLDS = { p75: 75, p90: 90, basis: "full" };

export function initialState(meta) {
  return {
    // The research edition opens on the case-study overview; the portfolio edition has none.
    page: IS_PORTFOLIO ? "explorer" : "overview",
    tab: "rolling",
    assetA: "BTC-USD",
    assetB: "SPY",
    period: "full",
    customRange: { start: meta.sample_start, end: meta.sample_end },
    regime: "all",
    frequency: "daily",
    window: 90,
    showBand: false,
    showFit: true,
    thresholds: PROTOCOL_THRESHOLDS,
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function explorerReducer(state, action) {
  switch (action.type) {
    case "setPage":
      return { ...state, page: action.page };
    case "setTab":
      return { ...state, tab: action.tab };
    case "setAsset": {
      const own = action.slot === "A" ? "assetA" : "assetB";
      const other = action.slot === "A" ? "assetB" : "assetA";
      if (action.asset === state[other]) return { ...state, [own]: state[other], [other]: state[own] };
      return { ...state, [own]: action.asset };
    }
    case "swapAssets":
      return { ...state, assetA: state.assetB, assetB: state.assetA };
    case "selectPair":
      if (!action.a || !action.b || action.a === action.b) return state;
      return { ...state, assetA: action.a, assetB: action.b, tab: action.tab ?? "rolling", page: "explorer" };
    case "setPeriod":
      return { ...state, period: action.period };
    case "setCustomRange": {
      const range = { ...state.customRange, ...action.range };
      if (range.start > range.end) return state;
      return { ...state, period: "custom", customRange: range };
    }
    case "setRegime":
      return { ...state, regime: action.regime };
    case "setFrequency":
      if (action.frequency === state.frequency) return state;
      return { ...state, frequency: action.frequency, window: WINDOW_OPTIONS[action.frequency].fallback };
    case "setWindow": {
      const { min, max } = WINDOW_OPTIONS[state.frequency];
      const w = Math.round(Number(action.window));
      return Number.isFinite(w) ? { ...state, window: clamp(w, min, max) } : state;
    }
    case "setOption":
      return { ...state, [action.key]: Boolean(action.value) };
    case "setThresholds": {
      const next = { ...state.thresholds, ...action.thresholds };
      next.p75 = clamp(Math.round(next.p75), 50, 98);
      next.p90 = clamp(Math.round(next.p90), 51, 99);
      if (next.p90 <= next.p75) return state;
      return { ...state, thresholds: next };
    }
    case "applySettings": {
      const { settings } = action;
      if (validateSettings(settings).length) return state;
      return {
        ...state,
        frequency: settings.frequency,
        window: Math.round(Number(settings.window)),
        showBand: Boolean(settings.showBand),
        showFit: Boolean(settings.showFit),
        thresholds: { p75: Number(settings.thresholds.p75), p90: Number(settings.thresholds.p90), basis: settings.thresholds.basis },
      };
    }
    case "resetValidated":
      return {
        ...state,
        period: ["full", "pre_etf", "etf"].includes(state.period) ? state.period : "full",
        frequency: "daily",
        window: FROZEN_WINDOWS.includes(state.window) && state.frequency === "daily" ? state.window : 90,
        showBand: false,
        thresholds: PROTOCOL_THRESHOLDS,
      };
    default:
      return state;
  }
}

/** True when the VIX regime cutoffs equal the pre-registered ones. */
export function thresholdsAreFrozen(thresholds, rangeIsFull) {
  return thresholds.p75 === 75 && thresholds.p90 === 90 && (thresholds.basis === "full" || rangeIsFull);
}

/** The subset of state edited in the Advanced settings panel. */
export function settingsOf(state) {
  const { frequency, window, showBand, showFit, thresholds } = state;
  return { frequency, window, showBand, showFit, thresholds };
}

/** Defaults that correspond to the pre-registered research configuration. */
export const VALIDATED_SETTINGS = { frequency: "daily", window: 90, showBand: false, showFit: true, thresholds: PROTOCOL_THRESHOLDS };

/** Field-level validation messages for staged settings; empty when valid. */
export function validateSettings(settings) {
  const issues = [];
  const bounds = WINDOW_OPTIONS[settings.frequency];
  if (!bounds) return [{ field: "frequency", message: "Choose daily, weekly or monthly returns." }];
  const w = Number(settings.window);
  if (!Number.isInteger(w) || w < bounds.min || w > bounds.max) {
    issues.push({ field: "window", message: `Window must be a whole number between ${bounds.min} and ${bounds.max} ${settings.frequency === "daily" ? "trading days" : settings.frequency === "weekly" ? "weeks" : "months"}.` });
  }
  const { p75, p90, basis } = settings.thresholds;
  if (!Number.isInteger(Number(p75)) || p75 < 50 || p75 > 98) issues.push({ field: "p75", message: "Elevated percentile must be a whole number from 50 to 98." });
  if (!Number.isInteger(Number(p90)) || p90 < 51 || p90 > 99) issues.push({ field: "p90", message: "Severe percentile must be a whole number from 51 to 99." });
  else if (Number(p90) <= Number(p75)) issues.push({ field: "p90", message: "Severe percentile must be above the elevated percentile." });
  if (!["full", "range"].includes(basis)) issues.push({ field: "basis", message: "Choose a threshold basis." });
  return issues;
}

/**
 * Settings that differ from the pre-registered configuration. Informational:
 * the research status still requires the full configuration (pair, period,
 * regime) to match an artifact, which research.js checks.
 */
export function settingsDeviations(settings, rangeIsFull) {
  const out = [];
  if (settings.frequency !== "daily") out.push({ key: "frequency", label: "Return frequency", current: settings.frequency, validated: "daily" });
  if (settings.frequency === "daily" && !FROZEN_WINDOWS.includes(Number(settings.window))) {
    out.push({ key: "window", label: "Rolling window", current: `${settings.window} days`, validated: FROZEN_WINDOWS.join(", ") + " days" });
  }
  if (settings.showBand) out.push({ key: "band", label: "Fisher-z band", current: "shown", validated: "not part of the protocol" });
  if (!thresholdsAreFrozen(settings.thresholds, rangeIsFull)) {
    const t = settings.thresholds;
    out.push({ key: "thresholds", label: T.volCutoffs, current: `${t.p75}th / ${t.p90}th, ${t.basis === "full" ? "full sample" : "period"}`, validated: "75th / 90th, full sample" });
  }
  return out;
}

/** True when two settings objects are equivalent. */
export function sameSettings(a, b) {
  return (
    a.frequency === b.frequency &&
    Number(a.window) === Number(b.window) &&
    a.showBand === b.showBand &&
    a.showFit === b.showFit &&
    Number(a.thresholds.p75) === Number(b.thresholds.p75) &&
    Number(a.thresholds.p90) === Number(b.thresholds.p90) &&
    a.thresholds.basis === b.thresholds.basis
  );
}
