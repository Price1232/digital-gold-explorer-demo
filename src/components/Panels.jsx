export function ViewHeader({ title, description, badge, children }) {
  return (
    <div className="view-header">
      <div className="view-heading">
        <div className="view-title-row">
          <h2>{title}</h2>
          {badge}
        </div>
        {description && <p className="view-description">{description}</p>}
      </div>
      {children && <div className="view-controls">{children}</div>}
    </div>
  );
}

export function Canvas({ title, note, children }) {
  return (
    <section className="canvas">
      {(title || note) && (
        <header className="canvas-header">
          {title && <h3>{title}</h3>}
          {note && <span className="canvas-note">{note}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function DataTable({ columns, rows, dense }) {
  return (
    <div className="table-wrap">
      <table className={`data-table ${dense ? "dense" : ""}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "num" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key ?? i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "num" : ""}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Reports how closely the browser recomputation reproduces the frozen engine output. */
export function ParityNote({ parity, what }) {
  if (!parity) return null;
  const ok = parity.n > 0 && parity.max < 1e-9 && parity.mismatched === 0;
  return (
    <p className={`parity ${ok ? "ok" : "warn"}`}>
      {ok ? "✓" : "⚠"} Engine parity for {what}: browser recomputation matches the frozen table on{" "}
      {parity.n.toLocaleString()} points (max |Δ| = {parity.max.toExponential(1)}
      {parity.mismatched ? `, ${parity.mismatched} missing-value mismatches` : ""}).
    </p>
  );
}
