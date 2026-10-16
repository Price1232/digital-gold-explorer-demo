// Charcoal chart-canvas theme shared by every Plotly figure.

import { T } from "./edition.js";

export const ASSET_COLORS = {
  "BTC-USD": "#e8913a",
  GLD: "#d6b65c",
  SPY: "#6fa8dc",
  QQQ: "#a993d6",
  TLT: "#5fb58c",
  IEF: "#8cc5c0",
};

export const GOLD = "#d4af5a";

export const REGIME_COLORS = {
  Normal: "#7d8796",
  Elevated: "#e0a63a",
  Severe: "#f2555a",
};

export const REGIME_FILLS = {
  Elevated: "rgba(224, 166, 58, 0.10)",
  Severe: "rgba(242, 85, 90, 0.16)",
};

const CANVAS = "#1d1e22";
const GRID = "#2c2d32";
const TEXT = "#d9d5cc";
const MUTED = "#8f8a80";

export function baseLayout(overrides = {}) {
  return {
    paper_bgcolor: CANVAS,
    plot_bgcolor: CANVAS,
    font: { family: "Inter, system-ui, sans-serif", color: TEXT, size: 12 },
    margin: { l: 56, r: 20, t: 16, b: 44 },
    hovermode: "x unified",
    hoverlabel: { bgcolor: "#26272c", bordercolor: "#3a3b41", font: { color: "#f1ede4" } },
    legend: { orientation: "h", x: 0, y: 1.08, bgcolor: "rgba(0,0,0,0)", font: { color: TEXT } },
    xaxis: { gridcolor: GRID, zerolinecolor: GRID, linecolor: GRID, tickfont: { color: MUTED } },
    yaxis: { gridcolor: GRID, zerolinecolor: "#45464c", linecolor: GRID, tickfont: { color: MUTED } },
    ...overrides,
  };
}

/** Vertical marker for the U.S. spot-Bitcoin ETF launch (2024-01-11), or the portfolio demo split. */
export function etfMarker(date) {
  return {
    shape: {
      type: "line",
      xref: "x",
      yref: "paper",
      x0: date,
      x1: date,
      y0: 0,
      y1: 1,
      line: { color: "#9c968a", width: 1, dash: "dot" },
    },
    annotation: {
      x: date,
      y: 1,
      xref: "x",
      yref: "paper",
      text: T.splitMarker,
      showarrow: false,
      xanchor: "left",
      yanchor: "top",
      font: { size: 10, color: "#9c968a" },
    },
  };
}

export function regimeShapes(segments) {
  return segments.map((s) => ({
    type: "rect",
    xref: "x",
    yref: "paper",
    x0: s.x0,
    x1: s.x1,
    y0: 0,
    y1: 1,
    fillcolor: REGIME_FILLS[s.label],
    line: { width: 0 },
    layer: "below",
  }));
}

export const PLOT_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
};

/** Crosshair-style spike lines that follow the cursor along an axis. */
export const CROSSHAIR = {
  showspikes: true,
  spikemode: "across",
  spikesnap: "cursor",
  spikethickness: 1,
  spikedash: "dot",
  spikecolor: "#8f8a80",
};

/** Date-range shortcuts for time-series charts (view only; statistics are unaffected). */
export const RANGE_SELECTOR = {
  buttons: [
    { count: 1, label: "1Y", step: "year", stepmode: "backward" },
    { count: 3, label: "3Y", step: "year", stepmode: "backward" },
    { count: 5, label: "5Y", step: "year", stepmode: "backward" },
    { step: "all", label: "All" },
  ],
  x: 0,
  y: 1.02,
  yanchor: "bottom",
  bgcolor: "#26272c",
  activecolor: "#4a3f24",
  bordercolor: "#3b3c42",
  borderwidth: 1,
  font: { color: "#d9d5cc", size: 11 },
};
