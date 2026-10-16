import { useState } from "react";
import { downloadCsv, toCsv } from "../lib/exportCsv.js";

/** Downloads the displayed data as CSV with provenance; disabled when there is nothing to export. */
export default function ExportButton({ filename, spec }) {
  const [done, setDone] = useState(false);
  const empty = !spec || !spec.rows.length;
  return (
    <button
      type="button"
      className="ghost-button"
      disabled={empty}
      title={empty ? "No observations to export" : "Download the plotted data with sources and methodology"}
      onClick={() => {
        downloadCsv(filename, toCsv({ ...spec, generatedAt: new Date().toISOString() }));
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Downloaded ✓" : "Export CSV"}
    </button>
  );
}
