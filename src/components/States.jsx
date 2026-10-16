import { T } from "../lib/edition.js";

const ICONS = { loading: "◌", error: "!", insufficient: "∅", unavailable: "—" };

/** Full-panel state for loading, error, insufficient-data and unavailable-data cases. */
export default function StatePanel({ kind, title, children, height = 420 }) {
  return (
    <div className={`state-panel state-${kind}`} style={{ minHeight: height }} role={kind === "error" ? "alert" : "status"}>
      <span className="state-icon" aria-hidden="true">
        {ICONS[kind]}
      </span>
      <h3>{title}</h3>
      <div className="state-body">{children}</div>
    </div>
  );
}

const Bone = ({ w, h }) => <span className="sk" style={{ width: w, height: h }} />;

/**
 * Layout-preserving placeholder for the explorer while research data loads.
 * The caller passes the real (static, disabled) intro and controls, so they
 * wrap exactly as they will once loaded and the chart does not jump.
 */
export function ExplorerSkeleton({ intro, controls }) {
  return (
    <div className="explorer skeleton-page" role="status" aria-live="polite">
      <span className="sr-only">{T.loading}</span>
      <header className="page-header">
        {intro}
        <div className="share skeleton-controls" aria-hidden="true" inert>
          <button type="button" className="ghost-button" disabled>
            Copy link to this analysis
          </button>
          <span className="share-status" />
        </div>
      </header>
      <div className="skeleton-controls" aria-hidden="true" inert>
        {controls}
      </div>
      <div className="tabs skeleton-tabs">
        <Bone w={130} h={16} />
        <Bone w={150} h={16} />
        <Bone w={130} h={16} />
      </div>
      <div className="explorer-body">
        <Bone w="100%" h={580} />
        <Bone w="100%" h={580} />
      </div>
    </div>
  );
}
