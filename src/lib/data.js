import { IS_PORTFOLIO } from "./edition.js";
import { logReturns } from "./stats.js";

export const ASSETS = ["BTC-USD", "GLD", "SPY", "QQQ", "TLT", "IEF"];
export const COUNTERPARTS = ["GLD", "SPY", "QQQ", "TLT"];
export const BETA_BENCHMARKS = ["SPY", "QQQ", "GLD"];

// Internal series keys are shared by both editions so the analysis code is
// identical. The portfolio edition's series are synthetic, so they are shown
// under neutral synthetic names and codes, never as real tickers.
const RESEARCH_LABELS = {
  "BTC-USD": "Bitcoin",
  GLD: "Gold (GLD)",
  SPY: "S&P 500 (SPY)",
  QQQ: "Nasdaq-100 (QQQ)",
  TLT: "Long Treasuries (TLT)",
  IEF: "Intermediate Treasuries (IEF)",
};

export const PORTFOLIO_LABELS = {
  "BTC-USD": "Synthetic crypto",
  GLD: "Synthetic gold",
  SPY: "Synthetic equity",
  QQQ: "Synthetic tech",
  TLT: "Synthetic long bond",
  IEF: "Synthetic mid bond",
};

export const PORTFOLIO_CODES = {
  "BTC-USD": "CRYPTO",
  GLD: "GOLD",
  SPY: "EQUITY",
  QQQ: "TECH",
  TLT: "LONGBOND",
  IEF: "MIDBOND",
};

export const ASSET_LABELS = IS_PORTFOLIO ? PORTFOLIO_LABELS : RESEARCH_LABELS;

/** Code shown in URLs, file names and CSV columns (the ticker in the research edition). */
export const assetCode = (asset) => (IS_PORTFOLIO ? PORTFOLIO_CODES[asset] : asset);

/** Series key for a code from `assetCode`, or undefined. */
export const assetFromCode = (code) => ASSETS.find((a) => assetCode(a) === code);

/** Load the frozen export and derive log returns on the common calendar. */
export async function loadExplorerData(signal) {
  const missing = IS_PORTFOLIO
    ? `data/explorer.json is missing or unreadable. Run "npm run portfolio:generate", then reload.`
    : `data/explorer.json is missing or unreadable. Run "npm run export-data" in the dashboard folder (see README for the Python environment), then reload.`;
  const response = await fetch(`${import.meta.env.BASE_URL}data/explorer.json`, { signal });
  // Dev servers answer unknown paths with index.html, so check the type as well as the status.
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("json")) {
    throw new Error(`${missing} (HTTP ${response.status})`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(missing);
  }
  if (!data?.meta || !data?.prices || !data?.tables) throw new Error(`${missing} The file does not have the expected structure.`);
  if (IS_PORTFOLIO) {
    // Accept only the synthetic dataset, and map its neutral field names onto
    // the ones the shared analysis code reads.
    if (data.meta.edition !== "portfolio-synthetic") throw new Error(`${missing} The file is not the synthetic portfolio dataset.`);
    data.vix = data.vol_index;
    data.meta.etf_era_start = data.meta.split_date;
  }
  data.returns = Object.fromEntries(ASSETS.map((a) => [a, logReturns(data.prices[a])]));
  return data;
}

export { rangeIndices } from "./periods.js";
