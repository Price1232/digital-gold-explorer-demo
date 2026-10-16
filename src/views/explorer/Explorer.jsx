import { useDeferredValue, useMemo, useState } from "react";
import Tabs from "../../components/Tabs.jsx";
import { ASSETS } from "../../lib/data.js";
import { FREQUENCIES, buildSeries } from "../../lib/returns.js";
import { ExplorerControls } from "./ExplorerControls.jsx";
import RollingView from "./RollingView.jsx";
import { IS_PORTFOLIO } from "../../lib/edition.js";
import ScatterView from "./ScatterView.jsx";
import MatrixView from "./MatrixView.jsx";

export const EXPLORER_TABS = [
  { id: "rolling", label: () => "Rolling correlation" },
  { id: "scatter", label: (state) => `${FREQUENCIES[state.frequency].label}-return scatter` },
  { id: "matrix", label: () => "Correlation matrix" },
];

/** Static page introduction, shared with the loading skeleton so the layout does not jump. */
export function ExplorerIntro() {
  return (
    <div>
      <p className="eyebrow">Relationships</p>
      <h2>Asset Relationship Explorer</h2>
      {IS_PORTFOLIO ? (
        <p className="page-description">
          Compare any two synthetic series: rolling correlation, return scatter with OLS beta, and the full correlation matrix. Every
          number is computed in your browser from <strong>synthetic demo data</strong>, not historical market observations.
        </p>
      ) : (
        <p className="page-description">
          Compare any two assets on the validated common trading calendar. Results that reproduce a frozen research artifact are
          marked <strong>Validated</strong>; every other configuration is <strong>Exploratory</strong>.
        </p>
      )}
    </div>
  );
}

function CopyLinkButton() {
  const [message, setMessage] = useState(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied");
    } catch {
      setMessage("Copy blocked: use the address bar URL");
    }
    setTimeout(() => setMessage(null), 2500);
  };
  return (
    <div className="share">
      <button type="button" className="ghost-button" onClick={copy} title="Copy a link that reopens this exact analysis">
        Copy link to this analysis
      </button>
      <span className="share-status" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

export default function Explorer({ data, state, dispatch, ctx }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Charts and interpretation render from deferred values: controls respond
  // immediately, while the previous chart stays visibly marked as updating
  // until the new calculation has rendered. React drops superseded renders,
  // so a stale selection can never replace a newer one.
  const view = useDeferredValue(state);
  const viewCtx = useDeferredValue(ctx);
  const pending = view !== state || viewCtx !== ctx;

  const series = useMemo(() => buildSeries(data.dates, data.prices, ASSETS, view.frequency), [data, view.frequency]);
  const props = { data, state: view, dispatch, ctx: viewCtx, series, pending };

  return (
    <div className="explorer">
      <header className="page-header">
        <ExplorerIntro />
        <CopyLinkButton />
      </header>

      <ExplorerControls data={data} state={state} dispatch={dispatch} ctx={ctx} advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen} />

      <Tabs
        label="Explorer views"
        panelId="explorer-panel"
        tabs={EXPLORER_TABS.map((t) => ({ id: t.id, label: t.label(state) }))}
        active={state.tab}
        onChange={(tab) => dispatch({ type: "setTab", tab })}
      />

      <div
        id="explorer-panel"
        role="tabpanel"
        aria-labelledby={`tab-${state.tab}`}
        aria-busy={pending}
        className={`explorer-panel ${pending ? "is-pending" : ""}`}
      >
        <span className="pending-indicator" aria-hidden={!pending}>
          Updating…
        </span>
        <div key={view.tab} className="view-frame">
          {view.tab === "rolling" && <RollingView {...props} />}
          {view.tab === "scatter" && <ScatterView {...props} />}
          {view.tab === "matrix" && <MatrixView {...props} />}
        </div>
      </div>
    </div>
  );
}
