// Small server-rendered SVG charts for the admin. No chart library: they render instantly and need no JS.

const fmtEUR = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: n >= 1000 ? 0 : 2 });

/** Daily values over a period, drawn as an area with a line on top. */
export function AreaChart({ points, height = 180, label }: { points: { date: string; value: number }[]; height?: number; label: string }) {
  const W = 640;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = (W - pad.l - pad.r) / Math.max(1, points.length - 1);
  const x = (i: number) => pad.l + i * step;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const ticks = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
  const best = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}: ${fmtEUR(total)} in total`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * f} y2={pad.t + (H - pad.t - pad.b) * f} stroke="var(--line)" strokeDasharray="3 5" />
        ))}
        <path d={area} fill="var(--forest)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {total > 0 && (
          <g>
            <circle cx={x(best)} cy={y(points[best].value)} r="4.5" fill="var(--saffron)" stroke="white" strokeWidth="2" />
            <text x={Math.min(Math.max(x(best), 40), W - 40)} y={Math.max(y(points[best].value) - 9, 11)} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
              {fmtEUR(points[best].value)}
            </text>
          </g>
        )}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 5} fontSize="11" fill="var(--muted)" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
            {new Date(points[i].date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
          </text>
        ))}
      </svg>
    </figure>
  );
}

const DONUT_COLORS = ["var(--forest)", "var(--saffron)", "var(--terra)", "var(--indigo)", "var(--sand)", "var(--muted)"];

/** Share of a whole, with a legend that carries the numbers so colour is never the only cue. */
export function Donut({ items, centerLabel }: { items: { label: string; value: number }[]; centerLabel: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label={`${centerLabel}: ${total}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface)" strokeWidth="18" />
        {total > 0 &&
          items.map((it, i) => {
            const len = (it.value / total) * C;
            const el = (
              <circle key={it.label} cx="70" cy="70" r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="18"
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />
            );
            acc += len;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)">{total}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="11" fill="var(--muted)">{centerLabel}</text>
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden />
            <span className="flex-1">{it.label}</span>
            <span className="font-semibold tabular-nums">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars. */
export function Bars({ items, format = "number", color = "var(--terra)" }: { items: { label: string; value: number; href?: string }[]; format?: "number" | "eur"; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const f = (v: number) => (format === "eur" ? fmtEUR(v) : v.toLocaleString("de-DE"));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label} className="text-sm">
          <div className="flex justify-between gap-3">
            {it.href ? <a href={it.href} className="truncate hover:text-terra">{it.label}</a> : <span className="truncate">{it.label}</span>}
            <span className="shrink-0 font-semibold tabular-nums">{f(it.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface">
            <div className="h-2 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A half-circle gauge for a percentage, coloured by how healthy the number is. */
export function Gauge({ value, label, detail, good = 80, ok = 50 }: { value: number; label: string; detail?: string; good?: number; ok?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const R = 54;
  const L = Math.PI * R;
  const color = v >= good ? "var(--forest)" : v >= ok ? "var(--saffron)" : "var(--terra)";
  return (
    <div className="text-center">
      <svg viewBox="0 0 140 82" className="mx-auto h-auto w-full max-w-[11rem]" role="img" aria-label={`${label}: ${Math.round(v)} percent`}>
        <path d="M16 74 A54 54 0 0 1 124 74" fill="none" stroke="var(--surface)" strokeWidth="14" strokeLinecap="round" />
        <path d="M16 74 A54 54 0 0 1 124 74" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(v / 100) * L} ${L}`} />
        <text x="70" y="70" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--ink)">{Math.round(v)}%</text>
      </svg>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      {detail && <div className="text-xs text-muted">{detail}</div>}
    </div>
  );
}
