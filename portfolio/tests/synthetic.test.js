import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DISCLOSURE, KEYS, OUTPUT, SEED, cholesky, correlationFor, fourDecimals, generateSynthetic, mulberry32, serialize, weekdays,
} from "../scripts/generate-synthetic.mjs";

const payload = generateSynthetic(SEED);

test("the generator is deterministic for a seed and changes with the seed", () => {
  assert.equal(serialize(generateSynthetic(SEED)), serialize(payload));
  assert.notEqual(serialize(generateSynthetic(SEED + 1)), serialize(payload));
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test("the published dataset is exactly the generator output", () => {
  assert.equal(readFileSync(OUTPUT, "utf8"), serialize(payload));
});

test("the dataset is labelled synthetic and has no research fields", () => {
  assert.equal(payload.meta.edition, "portfolio-synthetic");
  assert.equal(payload.meta.disclosure, DISCLOSURE);
  assert.equal(DISCLOSURE, "Portfolio demo — synthetic data, not historical market observations.");
  assert.deepEqual(payload.tables, {});
  for (const key of ["vix", "rolling_correlation", "rolling_beta"]) assert.ok(!(key in payload), key);
  for (const key of ["vix_thresholds", "classification", "role_key", "reference", "sources", "etf_era_start"]) assert.ok(!(key in payload.meta), key);
  assert.deepEqual(payload.meta.frozen_windows, { correlation: [], beta: [] });
});

test("series are complete, positive and aligned to a weekday calendar", () => {
  const n = payload.dates.length;
  assert.ok(n > 2000);
  assert.deepEqual(payload.dates, weekdays(payload.meta.sample_start, payload.meta.sample_end));
  for (const d of payload.dates) assert.ok(![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()), d);
  assert.deepEqual(Object.keys(payload.prices), KEYS);
  for (const series of [...Object.values(payload.prices), payload.vol_index]) {
    assert.equal(series.length, n);
    for (const v of series) assert.ok(Number.isFinite(v) && v > 0);
  }
  assert.ok(payload.meta.split_date > payload.meta.sample_start && payload.meta.split_date < payload.meta.sample_end);
});

test("every stored value keeps at least three decimals", () => {
  for (const v of [...Object.values(payload.prices).flat(), ...payload.vol_index]) {
    assert.match(String(v), /\.\d{3,4}$/, String(v));
  }
  assert.equal(fourDecimals(12.3), 12.3001);
  assert.equal(fourDecimals(12.34567), 12.3457);
});

test("every state's correlation matrix is positive definite", () => {
  for (const state of [0, 1, 2]) {
    for (const post of [false, true]) {
      const m = correlationFor(state, post);
      for (let i = 0; i < m.length; i += 1) {
        assert.equal(m[i][i], 1);
        for (let j = 0; j < m.length; j += 1) assert.equal(m[i][j], m[j][i]);
      }
      assert.doesNotThrow(() => cholesky(m));
    }
  }
  assert.throws(() => cholesky([[1, 2], [2, 1]]), /positive definite/);
});
