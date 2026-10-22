"use client";

import { boxFill, frozenWeight, type FrozenPack } from "@/lib/frozen";
import { money } from "@/lib/format";
import type { CartLine } from "@/lib/types";

const kg = (g: number, lang: "de" | "en") =>
  (g / 1000).toLocaleString(lang === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const T = {
  de: {
    title: "Deine Tiefkühlbox",
    titleN: (n: number) => `${n} Tiefkühlboxen`,
    left: (x: string) => `Noch ${x} kg passen in diese Box.`,
    full: "Box voll – weitere Tiefkühlware kommt in eine neue Box.",
    box: (i: number) => `Box ${i}`,
    small:
      "Kleiner Hinweis: Für Tiefkühlware brauchen wir eine isolierte Box mit Kühlakkus. Die kostet gleich viel, ob 0,5 kg oder 5 kg darin sind. Füll deine Box gern auf – oder hol Tiefkühlware im Laden ab, dann fällt keine Verpackung an.",
    price: (box: string, total: string) => `Tiefkühl-Versand ca. ${total} je Box (davon ${box} Spezialverpackung).`,
    pickup: "Bei Abholung im Laden kostet die Verpackung nichts.",
  },
  en: {
    title: "Your frozen box",
    titleN: (n: number) => `${n} frozen boxes`,
    left: (x: string) => `${x} kg more fits in this box.`,
    full: "Box full – more frozen items go into a new box.",
    box: (i: number) => `Box ${i}`,
    small:
      "A small note: frozen food needs an insulated box with cooling packs. It costs the same whether 0.5 kg or 5 kg is inside. Feel free to fill your box – or pick up frozen items in store, where there is no packaging charge.",
    price: (box: string, total: string) => `Frozen delivery about ${total} per box (${box} of it is the special packaging).`,
    pickup: "Pickup in store has no packaging charge.",
  },
};

/** Insulated box that fills up with the frozen weight in the cart; a new box appears once one is full. */
export function FrozenBoxes({
  lines,
  pack,
  courier,
  courierMin = 0,
  local,
  lang,
  compact = false,
}: {
  lines: CartLine[];
  pack: FrozenPack;
  courier: number | null; // price of the frozen courier per parcel
  courierMin?: number; // minimum order value for the frozen courier
  local?: { radius: number; freeFrom: number | null; price: number } | null;
  lang: "de" | "en";
  compact?: boolean;
}) {
  const w = frozenWeight(lines);
  if (w <= 0) return null;
  // no frozen courier: frozen food only by pickup or local delivery – say so plainly instead of showing boxes
  if (courier == null) return <FrozenLocalOnly local={local ?? null} lang={lang} />;
  // flat-rate frozen express (no per-box packaging charge): explain the box instead of drawing it
  if (!pack.enabled || (pack.boxPrice === 0 && !pack.perBoxShipping)) return <FrozenExpress courier={courier} min={courierMin} local={local ?? null} lang={lang} />;
  if (!pack.enabled) return null;
  const t = T[lang];
  const fills = boxFill(w, pack);
  const cap = pack.boxKg * 1000;
  const lastLeft = Math.max(0, cap * fills.length - w);
  const small = w < pack.smallKg * 1000;
  const own = lang === "de" ? pack.smallNote.de : pack.smallNote.en;
  const perBox = (courier ?? 0) + pack.boxPrice;

  return (
    <section className="rounded-2xl border border-[#CFE3F2] bg-[#F3F9FD] p-4" aria-label={fills.length > 1 ? t.titleN(fills.length) : t.title}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#14466B]">{fills.length > 1 ? t.titleN(fills.length) : t.title}</h3>
        <span className="text-xs tabular-nums text-[#14466B]">{kg(w, lang)} kg</span>
      </div>

      <div className={`mt-3 flex flex-wrap ${compact ? "gap-2" : "gap-3"}`}>
        {fills.map((f, i) => (
          <Box key={i} fill={f} label={fills.length > 1 ? t.box(i + 1) : undefined} kgText={`${kg(Math.min(cap, w - i * cap), lang)} / ${kg(cap, lang)} kg`} size={compact ? 64 : 84} />
        ))}
      </div>

      <p className="mt-3 text-xs text-[#14466B]">{lastLeft > 0 ? t.left(kg(lastLeft, lang)) : t.full}</p>

      {small && <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs leading-relaxed text-ink">{own || t.small}</p>}

      <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted">
        {courier != null ? t.price(money(pack.boxPrice), money(perBox)) : null} {t.pickup}
      </p>
    </section>
  );
}

function FrozenExpress({ courier, min, local, lang }: { courier: number; min: number; local: { radius: number; freeFrom: number | null; price: number } | null; lang: "de" | "en" }) {
  const de = lang === "de";
  const r = local?.radius ? `${local.radius.toLocaleString("de-DE")} km` : null;
  const free = local?.freeFrom != null ? money(local.freeFrom) : null;
  return (
    <section className="rounded-2xl border border-[#CFE3F2] bg-[#F3F9FD] p-4 text-[#14466B]">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /></svg>
        {de ? "Tiefkühlware im Warenkorb" : "Frozen food in your cart"}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed">
        {de
          ? "Wir verschicken sie in einer isolierten Styroporbox mit Trockeneis per DHL Express – in der Regel innerhalb von 24 Stunden bei dir, ohne dass die Kühlkette unterbrochen wird."
          : "We ship it in an insulated polystyrene box with dry ice by DHL Express – usually with you within 24 hours, without breaking the cold chain."}
      </p>
      <p className="mt-2 text-xs leading-relaxed">
        <b>{de ? `Pauschal ${money(courier)}` : `Flat rate ${money(courier)}`}</b>
        {min > 0 ? (de ? ` · Mindestbestellwert ${money(min)}` : ` · minimum order ${money(min)}`) : ""}
      </p>
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted">
        {de ? "Oder kostenlos im Laden abholen" : "Or pick it up in store for free"}
        {r ? (de ? `, bzw. Lieferung im Umkreis von ${r}${free ? ` (ab ${free} kostenlos)` : ""}` : `, or local delivery within ${r}${free ? ` (free from ${free})` : ""}`) : ""}.
      </p>
    </section>
  );
}

function FrozenLocalOnly({ local, lang }: { local: { radius: number; freeFrom: number | null; price: number } | null; lang: "de" | "en" }) {
  const de = lang === "de";
  const r = local?.radius ? `${local.radius.toLocaleString("de-DE")} km` : null;
  const free = local?.freeFrom != null ? money(local.freeFrom) : null;
  return (
    <section className="rounded-2xl border border-[#CFE3F2] bg-[#F3F9FD] p-4 text-[#14466B]">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /></svg>
        {de ? "Tiefkühlware im Warenkorb" : "Frozen food in your cart"}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed">
        {de ? "Damit die Kühlkette sicher bleibt, gibt es Tiefkühlware nur " : "To keep it safely frozen, frozen food is only available "}
        <b>{de ? "zur Abholung im Laden" : "for pickup in store"}</b>
        {r && (
          <>
            {de ? " oder per " : " or by "}
            <b>{de ? `Lieferung im Umkreis von ${r}` : `delivery within ${r}`}</b>
            {free ? (de ? ` (ab ${free} kostenlos)` : ` (free from ${free})`) : ""}
          </>
        )}
        {de ? ". Kein Paketversand." : ". No parcel shipping."}
      </p>
    </section>
  );
}

function Box({ fill, label, kgText, size }: { fill: number; label?: string; kgText: string; size: number }) {
  // inner cavity of the box: x 10–90, y 30–88
  const top = 30;
  const h = 58;
  const level = top + h * (1 - fill);
  const id = `fz${Math.round(fill * 1000)}${size}${label ?? ""}`.replace(/\s/g, "");
  return (
    <figure className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label ? label + ": " : ""}${kgText}`}>
        <defs>
          <clipPath id={`${id}c`}>
            <rect x="10" y={top} width="80" height={h} rx="4" />
          </clipPath>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8FD0F5" />
            <stop offset="1" stopColor="#3C9AD6" />
          </linearGradient>
        </defs>
        {/* box body */}
        <rect x="6" y="26" width="88" height="66" rx="7" fill="#FFFFFF" stroke="#9CC4E0" strokeWidth="2" />
        <rect x="10" y={top} width="80" height={h} rx="4" fill="#EAF4FB" />
        {/* contents */}
        <g clipPath={`url(#${id}c)`}>
          <rect x="10" y={level} width="80" height={top + h - level} fill={`url(#${id}g)`} style={{ transition: "y .5s ease, height .5s ease" }} />
          {fill > 0.05 && <path d={`M10 ${level} q10 -3 20 0 t20 0 t20 0 t20 0`} fill="none" stroke="#C9EAFB" strokeWidth="1.5" />}
        </g>
        {/* lid */}
        <rect x="2" y="14" width="96" height="14" rx="5" fill="#14466B" />
        <rect x="40" y="18" width="20" height="5" rx="2.5" fill="#8FD0F5" />
        {/* snowflake */}
        <g stroke={fill > 0.55 ? "#FFFFFF" : "#3C9AD6"} strokeWidth="2.2" strokeLinecap="round" opacity=".9">
          <path d="M50 46v24M39.6 52l20.8 12M39.6 64l20.8-12" />
        </g>
      </svg>
      <figcaption className="mt-1 text-center text-[0.625rem] leading-tight text-[#14466B]">
        {label && <span className="block font-semibold">{label}</span>}
        <span className="tabular-nums">{kgText}</span>
      </figcaption>
    </figure>
  );
}
