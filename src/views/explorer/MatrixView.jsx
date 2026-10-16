import { useMemo } from "react";
import Plot from "../../components/Plot.jsx";
import Badge from "../../components/Badge.jsx";
import StatePanel from "../../components/States.jsx";
import Interpretation from "../../components/Interpretation.jsx";
import { ASSETS, ASSET_LABELS, assetCode } from "../../lib/data.js";
import { IS_PORTFOLIO, T } from "../../lib/edition.js";
import { MIN_OBS, assetTick as tick, cellToPair, correlationMatrix } from "../../lib/analysis.js";
import { matrixNarrative } from "../../lib/interpret.js";
import { assess, configFor, correlationArtifact, matrixStatus, regimeUnavailable } from "../../lib/research.js";
import { FREQUENCIES } from "../../lib/returns.js";
import { GOLD, baseLayout } from "../../lib/theme.js";
import { num } from "../../lib/format.js";
import ExportButton from "../../components/ExportButton.jsx";
import { RegimeUnavailable } from "./ScatterView.jsx";

export default function MatrixView({ data, state, ctx, series, dispatch, pending }) {
  const { frequency, regime, assetA, assetB } = state;
  const freq = FREQUENCIES[frequency];
  const unavailable = regimeUnavailable(state);

  const matrix = useMemo(
    () => (unavailable ? null : correlationMatrix(series, ASSETS, ctx.range, { labels: frequency === "daily" ? ctx.regime.labels : null, regime })),
    [unavailable, series, ctx.range, frequency, ctx.regime.labels, regime],
  );

  const cells = useMemo(() => {
    if (!matrix) return [];
    const cfg = configFor(state, ctx.regime.isFrozen);
    return matrix.cells.map((c) => ({ ...c, check: assess(correlationArtifact(data.tables, { ...cfg, assetA: c.a, assetB: c.b }), c.r) }));
  }, [matrix, data.tables, state, ctx]);

  const minN = cells.length ? Math.min(...cells.map((c) => c.n)) : 0;

  const figure = useMemo(() => {
    if (!matrix || minN < MIN_OBS) return null;
    const lookup = (a, b) => cells.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
    const z = ASSETS.map((row) => ASSETS.map((col) => (row === col ? 1 : lookup(row, col).r)));
    const hover = ASSETS.map((row) =>
      ASSETS.map((col) => {
        if (row === col) return `${ASSET_LABELS[row]}`;
        const c = lookup(row, col);
        return `${ASSET_LABELS[row]} vs ${ASSET_LABELS[col]}<br>r = ${num(c.r, 3)} · n = ${c.n.toLocaleString()}<br>${
          c.check.status === "validated" ? `Validated: ${c.check.source}` : IS_PORTFOLIO ? "Synthetic demo data" : "Exploratory: no matching research artifact"
        }<br><i>Click to open in rolling correlation</i>`;
      }),
    );
    const annotations = [];
    const shapes = [];
    ASSETS.forEach((row, i) =>
      ASSETS.forEach((col, j) => {
        const v = z[i][j];
        const validated = row !== col && lookup(row, col).check.status === "validated";
        annotations.push({
          x: tick(col),
          y: tick(row),
          text: row === col ? "1.00" : `${num(v, 2)}${validated ? " ✓" : ""}`,
          showarrow: false,
          font: { size: 12, color: Math.abs(v) > 0.55 ? "#1d1e22" : "#e9e4da", family: "JetBrains Mono, monospace" },
        });
        if ((row === assetA && col === assetB) || (row === assetB && col === assetA)) {
          shapes.push({ type: "rect", xref: "x", yref: "y", x0: j - 0.5, x1: j + 0.5, y0: i - 0.5, y1: i + 0.5, line: { color: "#f1ede4", width: 2 } });
        }
      }),
    );
    return {
      traces: [
        {
          type: "heatmap",
          x: ASSETS.map(tick),
          y: ASSETS.map(tick),
          z,
          text: hover,
          hovertemplate: "%{text}<extra></extra>",
          zmin: -1,
          zmax: 1,
          colorscale: [
            [0, "#b0503d"],
            [0.5, "#26272c"],
            [1, GOLD],
          ],
          xgap: 2,
          ygap: 2,
          colorbar: { thickness: 10, tickfont: { color: "#8f8a80" }, outlinewidth: 0 },
        },
      ],
      layout: baseLayout({
        hovermode: "closest",
        annotations,
        shapes,
        margin: { l: 64, r: 20, t: 16, b: 48 },
        xaxis: { ...baseLayout().xaxis, side: "bottom", type: "category" },
        yaxis: { ...baseLayout().yaxis, autorange: "reversed", type: "category" },
      }),
    };
  }, [matrix, minN, cells, assetA, assetB]);

  const title = `Correlation matrix · ${freq.label.toLowerCase()} returns${regime === "all" ? "" : ` · ${regime} ${T.vol} days`}`;

  if (unavailable) {
    return (
      <div className="explorer-body">
        <section className="chart-panel">
          <header className="chart-header">
            <h3>{title}</h3>
            <Badge kind="unavailable" />
          </header>
          <RegimeUnavailable state={state} />
        </section>
      </div>
    );
  }

  if (minN < MIN_OBS) {
    return (
      <div className="explorer-body">
        <section className="chart-panel">
          <header className="chart-header">
            <h3>{title}</h3>
            <Badge kind="insufficient" />
          </header>
          <StatePanel kind="insufficient" title="Too few paired observations" height={480}>
            <p>
              The smallest pair in the selected period and regime has {minN.toLocaleString()} paired {freq.label.toLowerCase()} returns; at least {MIN_OBS} are
              required for every cell.
            </p>
          </StatePanel>
        </section>
      </div>
    );
  }

  const status = matrixStatus(cells.map((c) => c.check));
  const validatedCells = cells.filter((c) => c.check.status === "validated");
  const unvalidated = cells.filter((c) => c.check.status !== "validated");
  const sample = cells[0];
  const reasons = [...new Set(unvalidated.flatMap((c) => c.check.reasons))];
  const exportSpec = {
    title: "Correlation matrix",
    status: { validated: "Validated", partial: "Partly validated", exploratory: IS_PORTFOLIO ? "Synthetic demo" : "Exploratory" }[status],
    config: {
      Frequency: `${freq.label} log returns`,
      Period: `${ctx.range.start} to ${ctx.range.end}`,
      Regime: regime === "all" ? "All days" : `${regime} ${T.vol} days`,
      ...(IS_PORTFOLIO ? {} : { "Validated pairs": `${validatedCells.length} of ${cells.length}` }),
    },
    notes: reasons.map((r) => `${IS_PORTFOLIO ? "Note" : "Exploratory cells"}: ${r}`),
    columns: [
      { key: "a", label: "asset_a" },
      { key: "b", label: "asset_b" },
      { key: "r", label: "correlation" },
      { key: "n", label: "observations" },
      { key: "status", label: "research_status" },
      { key: "source", label: "artifact_source" },
    ],
    rows: cells.map((c) => ({ a: assetCode(c.a), b: assetCode(c.b), r: c.r, n: c.n, status: IS_PORTFOLIO ? "synthetic" : c.check.status, source: c.check.source ?? "" })),
  };

  return (
    <div className="explorer-body">
      <section className="chart-panel">
        <header className="chart-header">
          <h3>{title}</h3>
          <div className="chart-actions">
            <Badge kind={status} />
            <ExportButton filename={`${IS_PORTFOLIO ? "synthetic_" : ""}correlation-matrix_${frequency}_${state.period}.csv`} spec={exportSpec} />
          </div>
        </header>
        <Plot
          label={`${title}. ${IS_PORTFOLIO ? "Synthetic demo data" : `${validatedCells.length} of ${cells.length} pairs validated`}. Use the table view below to open a pair with the keyboard.`}
          data={figure.traces}
          layout={figure.layout}
          height={480}
          onClick={(point) => {
            const pair = cellToPair(point, ASSETS);
            if (pair) dispatch({ type: "selectPair", ...pair, tab: "rolling" });
          }}
        />
        <p className="chart-note">
          Click any off-diagonal cell to open that pair as Asset A (row) and Asset B (column).
          {IS_PORTFOLIO ? "" : " ✓ marks a value that matches a research artifact."}
        </p>
        <details className="table-view">
          <summary>Table view: all {cells.length} pairs (keyboard accessible)</summary>
          <div className="table-wrap">
            <table className="data-table dense">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th className="num">Correlation</th>
                  <th className="num">Observations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((c) => (
                  <tr key={`${c.a}|${c.b}`}>
                    <td>
                      <button type="button" className="link-button" onClick={() => dispatch({ type: "selectPair", a: c.a, b: c.b, tab: "rolling" })}>
                        {tick(c.a)} vs {tick(c.b)}
                      </button>
                    </td>
                    <td className="num">{num(c.r, 3)}</td>
                    <td className="num">{c.n.toLocaleString()}</td>
                    <td>
                      <Badge kind={c.check.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <Interpretation
        pending={pending}
        about="Pairwise correlations of all six assets over the same dates. Gold cells are positive, red cells negative; darker means closer to zero."
        limitations={[
          "Each cell is a single full-period number and hides changes over time; use the rolling view for that.",
          ...(IS_PORTFOLIO ? [] : ["IEF has no tabulated research correlations, so its cells can never be validated."]),
        ]}
        status={status}
        reasons={reasons}
        narrative={matrixNarrative({ matrix: { cells }, focus: assetA })}
        facts={[
          { label: "Sample", value: `${sample.first} → ${sample.last}` },
          { label: "Observations per pair", value: [...new Set(cells.map((c) => c.n))].map((n) => n.toLocaleString()).join(", ") },
          { label: "Assets", value: ASSETS.map(tick).join(", ") },
          ...(IS_PORTFOLIO ? [] : [{ label: "Validated pairs", value: `${validatedCells.length} of ${cells.length}` }]),
        ]}
        checks={IS_PORTFOLIO ? [{ label: "All pairs", status: "exploratory", detail: "Computed in the browser from synthetic demo data." }] : [
          {
            label: "Validated pairs",
            status: validatedCells.length ? "validated" : "exploratory",
            detail: validatedCells.length
              ? `${validatedCells.map((c) => `${tick(c.a)}–${tick(c.b)}`).join(", ")} match ${[...new Set(validatedCells.map((c) => c.check.source))].join("; ")}.`
              : "No cell matches a research artifact for this configuration.",
          },
          ...(unvalidated.length
            ? [{ label: "Exploratory pairs", status: "exploratory", detail: unvalidated.map((c) => `${tick(c.a)}–${tick(c.b)}`).join(", ") }]
            : []),
        ]}
        methodology={[
          `Pearson correlation of ${freq.label.toLowerCase()} log returns for each pair over the same dates.`,
          regime === "all" ? "All observations in the period are used." : `Only ${T.regimeDays(regime)} are included.`,
          ...(IS_PORTFOLIO ? [] : ["IEF is in the validated price data but the engine did not tabulate its correlations, so IEF cells are always exploratory."]),
        ]}
      />
    </div>
  );
}
