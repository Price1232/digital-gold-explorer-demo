export const pct = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);
export const num = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));
export const signed = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-08-21" → "21 Aug 2026" (no timezone conversion). */
export const longDate = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "—");
