import Badge from "../../src/components/Badge.jsx";
import { Canvas, ViewHeader } from "../../src/components/Panels.jsx";

const PAGES = {
  stress: {
    title: "Stress regimes",
    what: "In the research edition, this page shows correlations conditional on volatility regime, downside beta, block-bootstrap uncertainty for severe-stress correlations, and a safe-haven reliability table.",
  },
  etf: {
    title: "Before vs after split",
    what: "In the research edition, this page compares correlations and a descriptive profile before and after the U.S. spot-Bitcoin ETF launch, with a split-date sensitivity check. The comparison is descriptive, not causal.",
  },
  integrity: {
    title: "Sources & discrepancies",
    what: "In the research edition, this page checks reported figures against the frozen research outputs, recomputes them in the browser, and shows data lineage and any discrepancies.",
  },
};

/** Explains a research-only page instead of rendering it. */
export default function ResearchOnly({ page, onNavigate }) {
  const p = PAGES[page];
  return (
    <>
      <ViewHeader title={p.title} badge={<Badge kind="unavailable">Not in demo</Badge>} />
      <Canvas title="Not included in the portfolio demo">
        <div className="unavailable-copy">
          <p>{p.what}</p>
          <p>
            Those results are computed from third-party market data that this public demo does not include, and they are research
            outputs rather than synthetic examples. Re-running them on synthetic data would produce tables that look like findings but
            describe nothing real, so the page is left out of this edition.
          </p>
          <p>
            The explorer and rolling-beta pages use the same calculation code on synthetic data. See{" "}
            <button type="button" className="link-button" onClick={() => onNavigate("about")}>
              Data &amp; methods
            </button>{" "}
            for how the demo dataset is generated.
          </p>
        </div>
      </Canvas>
    </>
  );
}
