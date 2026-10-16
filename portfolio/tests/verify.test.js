import { test } from "node:test";
import assert from "node:assert/strict";
import { DISCLOSURE, SEED, generateSynthetic, serialize } from "../scripts/generate-synthetic.mjs";
import { verifyPortfolio } from "../scripts/verify-portfolio.mjs";

const data = serialize(generateSynthetic(SEED));
const baseFiles = {
  "index.html": `<p>${DISCLOSURE}</p>`,
  "assets/index-abc.js": `const d = "${DISCLOSURE}";`,
  "assets/index-abc.css": "body{}",
  "data/explorer.json": data,
};
const run = (files = baseFiles, extra = {}) =>
  verifyPortfolio({ files: Object.keys(files), readText: (f) => files[f], expectedData: data, ...extra });
const withFile = (name, text) => ({ ...baseFiles, [name]: text });

test("a clean synthetic artifact passes", () => {
  assert.deepEqual(run(), { ok: true, problems: [] });
});

test("unexpected files are rejected", () => {
  const r = run(withFile("data/prices.csv", "a,b"));
  assert.equal(r.ok, false);
  assert.match(r.problems.join(), /unexpected files/);
});

test("a data file that is not the generator output is rejected", () => {
  const tampered = JSON.parse(data);
  tampered.prices.SPY[0] = 123.4567;
  const r = run(withFile("data/explorer.json", JSON.stringify(tampered)));
  assert.match(r.problems.join(), /differs from the seeded generator output/);
});

test("research fields in the data file are named", () => {
  const p = JSON.parse(data);
  p.vix = [1.5];
  p.meta.vix_thresholds = { p90: 1 };
  p.tables = { t: [] };
  const text = JSON.stringify(p);
  const r = verifyPortfolio({ files: Object.keys(baseFiles), readText: (f) => (f === "data/explorer.json" ? text : baseFiles[f]), expectedData: text });
  assert.match(r.problems.join(), /research fields: vix, meta\.vix_thresholds/);
  assert.match(r.problems.join(), /research tables/);
});

test("inline scripts are rejected because the CSP blocks them", () => {
  const r = run(withFile("index.html", `<p>${DISCLOSURE}</p><script>alert(1)</script>`));
  assert.match(r.problems.join(), /inline script/);
  assert.equal(run(withFile("index.html", `<p>${DISCLOSURE}</p><script src="./boot.js" defer></script>`)).ok, true);
});

test("a missing disclosure fails the build", () => {
  assert.match(run(withFile("index.html", "<p>demo</p>")).problems.join(), /index\.html does not show/);
  assert.match(run(withFile("assets/index-abc.js", "x")).problems.join(), /bundle does not contain/);
});

test("local paths and machine names are rejected", () => {
  // Built from parts so this test file itself carries no literal home path.
  const home = (root) => `/${root}/someone/project`;
  assert.match(run(withFile("assets/index-abc.css", `/* ${home("Users")} */`)).problems.join(), /local path/);
  assert.match(run(withFile("assets/index-abc.css", `/* ${home("home")} */`)).problems.join(), /local path/);
  const r = run(withFile("assets/index-abc.css", "/* built by alice-laptop */"), { localNames: ["alice-laptop"] });
  assert.match(r.problems.join(), /machine-specific/);
});

test("research-only markers are rejected", () => {
  const r = run(withFile("assets/index-abc.css", "/* results/tables/x.csv data-licensing */"));
  assert.match(r.problems.join(), /research-only markers: results\/tables, data-licensing/);
});

