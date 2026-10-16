import { IS_PORTFOLIO } from "../lib/edition.js";

const LABELS = {
  validated: "Validated",
  frozen: "Research artifact",
  exploratory: IS_PORTFOLIO ? "Synthetic demo" : "Exploratory",
  partial: "Partly validated",
  derived: "Derived",
  unavailable: "Unavailable",
  insufficient: "Insufficient data",
  verified: "Verified",
  mismatch: "Mismatch",
};

const TITLES = {
  validated: "Configuration and output match a verified research artifact.",
  frozen: "Read directly from a frozen research output table.",
  exploratory: IS_PORTFOLIO
    ? "Computed in the browser from synthetic demo data. Not a historical observation or a research result."
    : "Computed in the browser for a configuration that is not part of the pre-registered analysis.",
  partial: "Some values match verified research artifacts; the rest are exploratory.",
  derived: "Computed in the browser from validated data; the statistic itself is not a tabulated research output.",
};

export default function Badge({ kind, children, title }) {
  return (
    <span className={`badge badge-${kind}`} title={title ?? TITLES[kind]}>
      {children ?? LABELS[kind]}
    </span>
  );
}

/** Validated when no exploratory reasons apply; otherwise lists the reasons on hover. */
export function StatusBadge({ reasons }) {
  if (!reasons.length) return <Badge kind="validated" />;
  return <Badge kind="exploratory" title={`Exploratory because: ${reasons.join("; ")}`} />;
}
