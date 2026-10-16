// Runs the shared library code as the portfolio build sees it. node --test
// runs each file in its own process, so the compile-time constant can be set
// on globalThis before the modules are first imported.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.__DG_EDITION__ = "portfolio";
const edition = await import("../../src/lib/edition.js");
const data = await import("../../src/lib/data.js");
const research = await import("../../src/lib/research.js");
const { PERIODS } = await import("../../src/lib/periods.js");
const { encodeState, decodeState } = await import("../../src/lib/urlState.js");
const { initialState } = await import("../../src/lib/explorerState.js");
const { toCsv } = await import("../../src/lib/exportCsv.js");
const { scatterNarrative } = await import("../../src/lib/interpret.js");
const { assetTick } = await import("../../src/lib/analysis.js");

const meta = { sample_start: "2016-01-04", sample_end: "2025-12-31" };

test("the edition constant selects the portfolio wording", () => {
  assert.equal(edition.EDITION, "portfolio");
  assert.equal(edition.IS_PORTFOLIO, true);
  assert.equal(edition.T.vol, "vol index");
  assert.deepEqual(PERIODS.map((p) => p.label), ["Full sample", "Before demo split", "After demo split", "Custom range"]);
});

test("assets are shown only under synthetic names and codes", () => {
  for (const key of data.ASSETS) {
    assert.match(data.ASSET_LABELS[key], /^Synthetic /);
    assert.notEqual(data.assetCode(key), key);
    assert.equal(data.assetFromCode(data.assetCode(key)), key);
    assert.equal(assetTick(key), data.assetCode(key));
  }
  const text = scatterNarrative({ assetA: "BTC-USD", assetB: "SPY", fit: { r: 0.3, beta: 0.5, r2: 0.09 }, ci: null, frequencyLabel: "Daily" }).join(" ");
  assert.doesNotMatch(text, /Bitcoin|S&P|SPY|BTC/);
});

test("no result can be validated, even when a value matches", () => {
  const cfg = { assetA: "BTC-USD", assetB: "SPY", period: "full", regime: "all", frequency: "daily", thresholdsFrozen: true };
  assert.deepEqual(research.correlationArtifact({}, cfg), { reasons: [edition.SYNTHETIC_REASON] });
  assert.deepEqual(research.betaArtifact({}, cfg), { reasons: [edition.SYNTHETIC_REASON] });
  assert.equal(research.assess({ value: 0.5, source: "x" }, 0.5).status, "exploratory");
  const frozen = research.frozenRolling({}, { assetA: "BTC-USD", assetB: "SPY", frequency: "daily", window: 90 });
  assert.equal(research.rollingStatus(frozen, [0.1, 0.2]).status, "exploratory");
});

test("shareable URLs use synthetic codes and round-trip", () => {
  const defaults = initialState(meta);
  const state = { ...defaults, assetA: "QQQ", assetB: "TLT" };
  const query = encodeState(state, defaults);
  assert.equal(query, "a=TECH&b=LONGBOND");
  const back = decodeState(`?${query}`, defaults, { meta, assets: data.ASSETS });
  assert.equal(back.assetA, "QQQ");
  assert.equal(back.assetB, "TLT");
  // Research tickers are not accepted in the portfolio edition.
  assert.equal(decodeState("?a=QQQ", defaults, { meta, assets: data.ASSETS }).assetA, defaults.assetA);
});

test("pages the portfolio shell cannot render are not accepted from the URL", () => {
  const defaults = initialState(meta);
  assert.equal(defaults.page, "explorer");
  assert.equal(decodeState("?page=overview", defaults, { meta, assets: data.ASSETS }).page, "explorer");
  assert.equal(decodeState("?page=about", defaults, { meta, assets: data.ASSETS }).page, "about");
});

test("CSV downloads lead with the synthetic disclosure and cite only the generator", () => {
  const csv = toCsv({
    title: "t",
    config: {},
    status: "Synthetic demo",
    notes: [],
    columns: [{ key: "x", label: "x" }],
    rows: [{ x: 1 }],
    generatedAt: "2026-01-01T00:00:00Z",
  });
  const lines = csv.split("\n");
  assert.equal(lines[0], `# ${edition.PORTFOLIO_DISCLOSURE}`);
  assert.match(csv, /# Data status: Synthetic demo/);
  assert.match(csv, /generate-synthetic\.mjs/);
  assert.doesNotMatch(csv, /results\/tables|data\/processed|Research status/);
});
