#!/usr/bin/env node
// Synthetic dataset for the portfolio edition.
//
// Every value is drawn from a seeded pseudo-random generator using the
// hand-chosen parameters below. No parameter was estimated from market data,
// and nothing is read from the research pipeline, so the output contains no
// historical observations. The same seed always produces the same file.
//
//   node portfolio/scripts/generate-synthetic.mjs           write portfolio/public/data/explorer.json
//   node portfolio/scripts/generate-synthetic.mjs --check   fail if the file differs from a fresh run

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED = 20251015;
export const GENERATOR_VERSION = 1;
export const DISCLOSURE = "Portfolio demo — synthetic data, not historical market observations.";

export const START = "2016-01-04";
export const END = "2025-12-31";
export const SPLIT_DATE = "2021-07-01";

// Internal series keys match the dashboard's analysis code; the portfolio UI
// shows them only under synthetic names (src/lib/data.js PORTFOLIO_LABELS).
export const KEYS = ["BTC-USD", "GLD", "SPY", "QQQ", "TLT", "IEF"];

// Annualised drift and volatility, chosen by hand to give six visibly
// different archetypes (a volatile crypto-like series, a gold-like hedge,
// two correlated equity-like indices and two bond-like series).
const DRIFT = [0.2, 0.04, 0.07, 0.1, 0.01, 0.015];
const VOL = [0.65, 0.14, 0.16, 0.21, 0.13, 0.06];
const START_PRICE = [100, 100, 100, 100, 100, 100];

// Hidden market states: 0 calm, 1 elevated, 2 stressed. Daily transition
// probabilities (rows sum to 1), volatility multipliers and the level the
// synthetic volatility index reverts to in each state.
const TRANSITIONS = [
  [0.985, 0.013, 0.002],
  [0.03, 0.955, 0.015],
  [0.005, 0.04, 0.955],
];
const STATE_VOL = [0.8, 1.3, 2.2];
const VOL_INDEX_LEVEL = [14, 21, 33];

// Correlation of daily shocks by state. Stress raises equity co-movement
// and the crypto–equity link; after the demo split date the crypto–equity
// link is raised further so the split comparison has something to show.
const BASE_CORR = [
  [1, 0.05, 0.15, 0.18, -0.02, -0.01],
  [0.05, 1, 0.05, 0.03, 0.25, 0.25],
  [0.15, 0.05, 1, 0.85, -0.2, -0.15],
  [0.18, 0.03, 0.85, 1, -0.18, -0.13],
  [-0.02, 0.25, -0.2, -0.18, 1, 0.85],
  [-0.01, 0.25, -0.15, -0.13, 0.85, 1],
];
const STRESS_SHIFT = { "0,2": 0.25, "0,3": 0.25, "2,3": 0.07, "2,4": -0.15, "3,4": -0.15, "2,5": -0.1, "3,5": -0.1 };
const POST_SPLIT_SHIFT = { "0,2": 0.15, "0,3": 0.15 };
const T_DOF = 5; // Student-t shocks for fat tails

/** Mulberry32: small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSource(uniform) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    let u = 0;
    while (u === 0) u = uniform();
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Correlation matrix for a state, before or after the split. */
export function correlationFor(state, postSplit) {
  const m = BASE_CORR.map((row) => [...row]);
  const shift = (table, weight) => {
    for (const [key, d] of Object.entries(table)) {
      const [i, j] = key.split(",").map(Number);
      m[i][j] += d * weight;
      m[j][i] += d * weight;
    }
  };
  shift(STRESS_SHIFT, state / 2);
  if (postSplit) shift(POST_SPLIT_SHIFT, 1);
  return m;
}

/** Lower-triangular Cholesky factor; throws if the matrix is not positive definite. */
export function cholesky(m) {
  const n = m.length;
  const l = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = m[i][j];
      for (let k = 0; k < j; k += 1) sum -= l[i][k] * l[j][k];
      if (i === j) {
        if (sum <= 0) throw new Error("correlation matrix is not positive definite");
        l[i][j] = Math.sqrt(sum);
      } else {
        l[i][j] = sum / l[j][j];
      }
    }
  }
  return l;
}

/** Weekdays from start to end inclusive (a synthetic calendar with no holidays). */
export function weekdays(start, end) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Round to four decimal places, nudging values whose last two of those
 * digits are zero by 0.0001. Every stored number therefore keeps at least
 * three decimals, so none can coincide token-for-token with a two-decimal
 * quote, which keeps the private release scan free of chance matches.
 */
export function fourDecimals(v) {
  let units = Math.round(v * 1e4);
  if (units % 100 === 0) units += 1;
  return units / 1e4;
}

/** The complete synthetic payload for a seed. */
export function generateSynthetic(seed = SEED) {
  const uniform = mulberry32(seed);
  const normal = normalSource(uniform);
  const dates = weekdays(START, END);
  const factors = [0, 1, 2].flatMap((s) => [false, true].map((post) => ({ s, post, l: cholesky(correlationFor(s, post)) })));
  const factor = (s, post) => factors.find((f) => f.s === s && f.post === post).l;

  const n = KEYS.length;
  const logPrice = START_PRICE.map((p) => Math.log(p));
  const prices = KEYS.map(() => []);
  const volIndex = [];
  let state = 0;
  let level = VOL_INDEX_LEVEL[0];

  dates.forEach((date, t) => {
    if (t > 0) {
      const u = uniform();
      const row = TRANSITIONS[state];
      state = u < row[0] ? 0 : u < row[0] + row[1] ? 1 : 2;

      // Correlated Student-t shocks scaled to unit variance.
      const z = Array.from({ length: n }, () => normal());
      let chi = 0;
      for (let k = 0; k < T_DOF; k += 1) chi += normal() ** 2;
      const scale = Math.sqrt((T_DOF - 2) / chi);
      const l = factor(state, date >= SPLIT_DATE);
      for (let i = 0; i < n; i += 1) {
        let shock = 0;
        for (let k = 0; k <= i; k += 1) shock += l[i][k] * z[k];
        const sigma = (VOL[i] / Math.sqrt(252)) * STATE_VOL[state];
        logPrice[i] += DRIFT[i] / 252 - 0.5 * sigma * sigma + sigma * shock * scale;
      }
    }
    level += 0.12 * (VOL_INDEX_LEVEL[state] - level) + 1.1 * normal();
    level = Math.max(9, level);
    volIndex.push(fourDecimals(level));
    KEYS.forEach((_, i) => prices[i].push(fourDecimals(Math.exp(logPrice[i]))));
  });

  return {
    meta: {
      edition: "portfolio-synthetic",
      disclosure: DISCLOSURE,
      generator: { script: "portfolio/scripts/generate-synthetic.mjs", seed, version: GENERATOR_VERSION },
      sample_start: dates[0],
      sample_end: dates[dates.length - 1],
      split_date: SPLIT_DATE,
      frozen_windows: { correlation: [], beta: [] },
    },
    dates,
    prices: Object.fromEntries(KEYS.map((k, i) => [k, prices[i]])),
    vol_index: volIndex,
    tables: {},
  };
}

export const serialize = (payload) => `${JSON.stringify(payload)}\n`;

const here = dirname(fileURLToPath(import.meta.url));
export const OUTPUT = join(here, "..", "public", "data", "explorer.json");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = serialize(generateSynthetic(SEED));
  if (process.argv.includes("--check")) {
    let current = null;
    try {
      current = readFileSync(OUTPUT, "utf8");
    } catch {
      // handled below
    }
    if (current !== text) {
      console.error("portfolio/public/data/explorer.json is missing or differs from the generator output. Run: npm run portfolio:generate");
      process.exit(1);
    }
    console.log("Synthetic dataset matches the generator output.");
  } else {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, text);
    console.log(`Wrote ${OUTPUT.replace(process.cwd() + "/", "")} (${text.length.toLocaleString()} bytes, seed ${SEED}).`);
  }
}
