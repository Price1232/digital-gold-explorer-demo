// Build edition. The portfolio build (portfolio/vite.config.js) defines the
// compile-time constant __DG_EDITION__ = "portfolio"; the research build and
// Node tests leave it undefined, so the research edition is the default.
// Because the constant is substituted at build time, the minifier drops
// research-only branches from the portfolio bundle.

/* global __DG_EDITION__ */
export const EDITION = typeof __DG_EDITION__ !== "undefined" && __DG_EDITION__ === "portfolio" ? "portfolio" : "research";
export const IS_PORTFOLIO = EDITION === "portfolio";

export const PORTFOLIO_DISCLOSURE = "Portfolio demo — synthetic data, not historical market observations.";

/** Reason attached to every portfolio result: nothing can match a research artifact. */
export const SYNTHETIC_REASON = "synthetic demo data; this edition contains no research artifacts to validate against";

// Written as one conditional (not a lookup) so the build keeps only one edition's wording.
export const T = IS_PORTFOLIO
  ? {
      vol: "vol index",
      volRegime: "Vol-index regime",
      volCutoffs: "Vol-index cutoffs",
      regimeDays: (regime) => `${regime.toLowerCase()} vol-index days`,
      regimeControl: "Market regime (synthetic vol index)",
      preSplit: "Before demo split",
      postSplit: "After demo split",
      splitMarker: "Demo split",
      statusHeading: "Data status",
      reasonsHeading: "Notes",
      statusField: "Data status",
      loading: "Loading synthetic demo data…",
    }
  : {
      vol: "VIX",
      volRegime: "VIX regime",
      volCutoffs: "VIX cutoffs",
      regimeDays: (regime) => `${regime.toLowerCase()}-VIX days`,
      regimeControl: "Market regime (VIX)",
      preSplit: "Pre-ETF era",
      postSplit: "ETF era",
      splitMarker: "Spot ETF era",
      statusHeading: "Research status",
      reasonsHeading: "Why exploratory",
      statusField: "Research status",
      loading: "Loading validated research data…",
    };
