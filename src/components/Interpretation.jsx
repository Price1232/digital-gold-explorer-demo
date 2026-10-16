import Badge from "./Badge.jsx";
import { T } from "../lib/edition.js";

/**
 * Plain-English reading of the current chart, with the sample, method and the
 * research status of each headline statistic.
 */
export default function Interpretation({ status, statusLabel, about, reasons = [], narrative = [], facts = [], checks = [], methodology = [], limitations = [], pending = false }) {
  return (
    <aside className="interpretation" aria-label="Interpretation" aria-busy={pending}>
      <header className="interp-header">
        <h3>Interpretation</h3>
        <Badge kind={status}>{statusLabel}</Badge>
      </header>

      {about && <p className="interp-about">{about}</p>}

      {narrative.length > 0 && (
        <div className="interp-narrative">
          {narrative.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      {facts.length > 0 && (
        <dl className="interp-facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {checks.length > 0 && (
        <section className="interp-section">
          <h4>{T.statusHeading}</h4>
          <ul className="interp-checks">
            {checks.map((c) => (
              <li key={c.label}>
                <Badge kind={c.status} />
                <span>
                  <strong>{c.label}</strong>
                  {c.detail && <span className="interp-detail">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reasons.length > 0 && (
        <section className="interp-section">
          <h4>{T.reasonsHeading}</h4>
          <ul className="interp-reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {methodology.length > 0 && (
        <section className="interp-section">
          <h4>Methodology</h4>
          <ul className="interp-method">
            {methodology.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}
      {limitations.length > 0 && (
        <section className="interp-section">
          <h4>Limitations</h4>
          <ul className="interp-method">
            {limitations.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
