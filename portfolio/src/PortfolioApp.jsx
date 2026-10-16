// Portfolio edition shell. Reuses the shared explorer and rolling-beta views
// on the synthetic dataset; research-only pages are replaced by explanations.

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import StatePanel, { ExplorerSkeleton } from "../../src/components/States.jsx";
import { ASSETS, loadExplorerData } from "../../src/lib/data.js";
import { PORTFOLIO_DISCLOSURE } from "../../src/lib/edition.js";
import { explorerReducer, initialState, thresholdsAreFrozen } from "../../src/lib/explorerState.js";
import { periodRange, rangeIndices } from "../../src/lib/periods.js";
import { classifyVix, vixThresholds } from "../../src/lib/regimes.js";
import { decodeState, encodeState } from "../../src/lib/urlState.js";
import Explorer, { ExplorerIntro } from "../../src/views/explorer/Explorer.jsx";
import { ControlsPlaceholder, PeriodControl } from "../../src/views/explorer/ExplorerControls.jsx";
import RollingRelationship from "../../src/views/RollingRelationship.jsx";
import DataAndMethods from "./DataAndMethods.jsx";
import ResearchOnly from "./ResearchOnly.jsx";

const NAV = [
  { section: "Relationships", items: [{ id: "explorer", label: "Asset Relationship Explorer" }, { id: "beta", label: "Rolling beta" }] },
  {
    section: "Research edition only",
    items: [
      { id: "stress", label: "Stress regimes", note: "Not in demo" },
      { id: "etf", label: "Before vs after split", note: "Not in demo" },
      { id: "integrity", label: "Sources & discrepancies", note: "Not in demo" },
    ],
  },
  { section: "About", items: [{ id: "about", label: "Data & methods" }] },
];

function Shell({ meta, page, onNavigate, children }) {
  return (
    <div className="app">
      <p className="demo-banner" role="note">
        {PORTFOLIO_DISCLOSURE}
        {onNavigate && (
          <a
            href="?page=about"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("about");
            }}
          >
            How it works
          </a>
        )}
      </p>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">◆</span>
          <div>
            <h1>Digital Gold</h1>
            <p>Portfolio demo</p>
          </div>
        </div>
        {!meta && (
          <div className="topbar-meta" aria-hidden="true">
            <span className="sk" style={{ width: 190, height: 14 }} />
            <span className="sk" style={{ width: 120, height: 26, borderRadius: 999 }} />
          </div>
        )}
        {meta && (
          <div className="topbar-meta">
            <span className="meta-item">
              Synthetic sample {meta.sample_start} → {meta.sample_end}
            </span>
            <span className="demo-pill" title={`Generated with seed ${meta.generator.seed}; see Data & methods`}>
              Synthetic data
            </span>
          </div>
        )}
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label="Workspace">
          {NAV.map((group) => (
            <div key={group.section} className="nav-group">
              <p className="nav-section">{group.section}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${page === item.id ? "active" : ""}`}
                  aria-current={page === item.id ? "page" : undefined}
                  onClick={() => onNavigate?.(item.id)}
                  disabled={!onNavigate}
                >
                  {item.label}
                  {item.note && <span className="nav-note">{item.note}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-footer">
            <p>Synthetic demo data.</p>
            <p>Not investment advice.</p>
          </div>
        </nav>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}

function Workspace({ data }) {
  const defaults = useMemo(() => initialState(data.meta), [data.meta]);
  const [state, dispatch] = useReducer(explorerReducer, defaults, (d) =>
    decodeState(window.location.search, d, { meta: data.meta, assets: ASSETS }),
  );

  // Keep the address bar in sync so the current analysis can be bookmarked or shared.
  useEffect(() => {
    const query = encodeState(state, defaults);
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [state, defaults]);

  // A new page starts at the top, not at the scroll position of the previous one.
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [state.page]);

  const range = useMemo(() => periodRange(data.meta, state.period, state.customRange), [data.meta, state.period, state.customRange]);
  const idx = useMemo(() => rangeIndices(data.dates, range), [data.dates, range]);
  const rangeFull = range.start <= data.meta.sample_start && range.end >= data.meta.sample_end;

  const regime = useMemo(() => {
    const thresholds = vixThresholds(data.vix, idx, state.thresholds);
    return { thresholds, labels: classifyVix(data.vix, thresholds), isFrozen: thresholdsAreFrozen(state.thresholds, rangeFull) };
  }, [data.vix, idx, state.thresholds, rangeFull]);

  const ctx = useMemo(() => ({ data, range, idx, rangeFull, regime }), [data, range, idx, rangeFull, regime]);
  const navigate = (page) => dispatch({ type: "setPage", page });

  return (
    <Shell meta={data.meta} page={state.page} onNavigate={navigate}>
      {state.page === "explorer" && <Explorer data={data} state={state} dispatch={dispatch} ctx={ctx} />}
      {state.page === "beta" && (
        <>
          <div className="control-bar compact">
            <PeriodControl data={data} state={state} dispatch={dispatch} />
          </div>
          <RollingRelationship mode="beta" ctx={ctx} />
        </>
      )}
      {["stress", "etf", "integrity"].includes(state.page) && <ResearchOnly page={state.page} onNavigate={navigate} />}
      {state.page === "about" && <DataAndMethods meta={data.meta} />}
    </Shell>
  );
}

export default function PortfolioApp() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Abort on unmount (and StrictMode's double effect) so a superseded request never sets state.
    const controller = new AbortController();
    loadExplorerData(controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <Shell>
        <StatePanel kind="error" title="Demo data could not be loaded">
          <p>{error}</p>
        </StatePanel>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <ExplorerSkeleton intro={<ExplorerIntro />} controls={<ControlsPlaceholder />} />
      </Shell>
    );
  }
  return <Workspace data={data} />;
}
