/** Turns ?p=2026-10 | 2026-Q3 | 2026 | from..to into an inclusive date range (YYYY-MM-DD). */
export function resolvePeriod(p?: string, from?: string, to?: string) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const last = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 0))); // m is 1-based month → last day
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) return { from, to, label: `${from} – ${to}`, key: "custom" };
  const now = new Date();
  const v = p || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let m = v.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const y = +m[1], mo = +m[2];
    return { from: `${y}-${m[2]}-01`, to: last(y, mo), label: new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }), key: v };
  }
  m = v.match(/^(\d{4})-Q([1-4])$/);
  if (m) {
    const y = +m[1], q = +m[2];
    return { from: `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`, to: last(y, q * 3), label: `${q}. Quartal ${y}`, key: v };
  }
  m = v.match(/^(\d{4})$/);
  if (m) return { from: `${m[1]}-01-01`, to: `${m[1]}-12-31`, label: `Jahr ${m[1]}`, key: v };
  return resolvePeriod();
}
