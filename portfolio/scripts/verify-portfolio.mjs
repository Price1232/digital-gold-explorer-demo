#!/usr/bin/env node
// Post-build check of the portfolio artifact (portfolio/dist). Fails the build
// unless:
//   1. dist holds only index.html, boot.js, hashed assets and data/explorer.json,
//      and index.html has no inline scripts (the CSP forbids them);
//   2. dist/data/explorer.json is byte-identical to a fresh run of the seeded
//      generator and carries no research fields;
//   3. the built page and bundle carry the synthetic-data disclosure;
//   4. no file contains a local filesystem path or machine-specific string;
//   5. no file contains a research-only marker (artifact paths, licensing files).
// The private parent project additionally scans the build against
// fingerprints of its restricted research data; that step is not part of
// this repository.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DISCLOSURE, SEED, generateSynthetic, serialize } from "./generate-synthetic.mjs";

const PORTFOLIO = fileURLToPath(new URL("..", import.meta.url));
const ALLOWED = [/^index\.html$/, /^boot\.js$/, /^assets\/[\w.-]+\.(js|css)$/, /^data\/explorer\.json$/];

// Fields that exist only in the research payload.
const RESEARCH_KEYS = ["vix", "rolling_correlation", "rolling_beta", "returns"];
const RESEARCH_META_KEYS = ["vix_thresholds", "classification", "role_key", "reference", "sources", "etf_era_start"];

// Machine-specific strings: absolute home paths, Windows drives, file URLs.
const LOCAL_PATH = /(\/Users\/[^/\s"']+|\/home\/[^/\s"']+|[A-Za-z]:\\\\Users|file:\/\/\/)/;

// Strings that only research code or research files contain.
const RESEARCH_MARKERS = [
  "results/tables",
  "results/phase",
  "restricted-fingerprints",
  "data-licensing",
  "PENDING-GRANT",
  "analysis_protocol",
  "src/stress.py",
  "public/data/explorer.json, exported",
];

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * @param {object} input
 * @param {string[]} input.files  paths relative to dist
 * @param {(f: string) => string} input.readText
 * @param {string} input.expectedData  serialized generator output
 * @param {object|null} input.privateScan  { scan(text, isCode) => string[] } or null
 */
export function verifyPortfolio({ files, readText, expectedData, privateScan = null, localNames = [] }) {
  const problems = [];
  const unexpected = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
  if (unexpected.length) problems.push(`unexpected files in dist: ${unexpected.join(", ")}`);

  if (!files.includes("data/explorer.json")) {
    problems.push("dist/data/explorer.json is missing");
  } else {
    const text = readText("data/explorer.json");
    if (text !== expectedData) problems.push("dist/data/explorer.json differs from the seeded generator output");
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      problems.push("dist/data/explorer.json is not valid JSON");
    }
    if (payload) {
      if (payload.meta?.edition !== "portfolio-synthetic") problems.push("data file is not marked as the synthetic portfolio dataset");
      if (payload.meta?.disclosure !== DISCLOSURE) problems.push("data file does not carry the synthetic-data disclosure");
      const keys = RESEARCH_KEYS.filter((k) => k in payload);
      const metaKeys = RESEARCH_META_KEYS.filter((k) => k in (payload.meta ?? {}));
      if (keys.length || metaKeys.length) problems.push(`data file has research fields: ${[...keys, ...metaKeys.map((k) => `meta.${k}`)].join(", ")}`);
      if (Object.keys(payload.tables ?? {}).length) problems.push("data file has research tables");
    }
  }

  const html = files.includes("index.html") ? readText("index.html") : "";
  if (!html.includes(DISCLOSURE)) problems.push("index.html does not show the synthetic-data disclosure");
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) problems.push("index.html has an inline script, which the Content-Security-Policy blocks");
  const code = files.filter((f) => f.endsWith(".js")).map(readText).join("\n");
  if (!code.includes(DISCLOSURE)) problems.push("the app bundle does not contain the synthetic-data disclosure");

  for (const f of files) {
    const text = readText(f);
    const local = text.match(LOCAL_PATH);
    if (local) problems.push(`${f} contains a local path (${local[0]})`);
    for (const name of localNames) if (name && text.includes(name)) problems.push(`${f} contains a machine-specific string`);
    const markers = RESEARCH_MARKERS.filter((m) => text.includes(m));
    if (markers.length) problems.push(`${f} contains research-only markers: ${markers.join(", ")}`);
    if (privateScan) for (const p of privateScan.scan(text, /\.(js|css|html)$/.test(f))) problems.push(`${f} ${p}`);
  }
  return { ok: !problems.length, problems };
}

async function main() {
  const dist = join(PORTFOLIO, "dist");
  if (!existsSync(dist)) {
    console.error("verify-portfolio: portfolio/dist does not exist; run the portfolio build first.");
    process.exit(1);
  }
  const files = listFiles(dist).map((p) => relative(dist, p)).filter((p) => !p.endsWith(".DS_Store"));
  // The current user name and home directory must never appear in the artifact.
  const localNames = [process.env.USER, process.env.HOME].filter((v) => v && v.length > 2);
  const result = verifyPortfolio({
    files,
    readText: (f) => readFileSync(join(dist, f), "utf8"),
    expectedData: serialize(generateSynthetic(SEED)),
    localNames,
  });
  if (result.ok) {
    console.log(`verify-portfolio: PASS (${files.length} files checked).`);
    return;
  }
  console.error("verify-portfolio: FAILED");
  for (const p of result.problems) console.error(`  - ${p}`);
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
