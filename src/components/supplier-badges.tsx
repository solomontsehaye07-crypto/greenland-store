import { SUPPLIER_TYPES, supplierType } from "@/lib/supplier-types";

/** Coloured signs for what a supplier sells (e.g. 🐟 Fish & seafood). */
export function SupplierBadges({ types, compact = false, className = "" }: { types: string[] | null | undefined; compact?: boolean; className?: string }) {
  const list = (types ?? []).map(supplierType).filter(Boolean);
  if (!list.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {list.map((t) => (
        <span
          key={t!.key}
          title={t!.label}
          className={`inline-flex items-center gap-1 rounded-full font-semibold text-white ${compact ? "px-1.5 py-0.5 text-[0.6875rem]" : "px-2 py-0.5 text-xs"}`}
          style={{ background: t!.bg }}
        >
          <span aria-hidden>{t!.icon}</span>
          {compact ? <span className="sr-only">{t!.label}</span> : t!.label}
        </span>
      ))}
    </span>
  );
}

/** Checkboxes to choose a supplier's product types (form field name "specialties"). */
export function SupplierTypePicker({ value = [] }: { value?: string[] }) {
  return (
    <fieldset>
      <legend className="label">What do they sell? (choose all that fit)</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {SUPPLIER_TYPES.map((t) => (
          <label key={t.key} className="cursor-pointer">
            <input type="checkbox" name="specialties" value={t.key} defaultChecked={value.includes(t.key)} className="peer sr-only" />
            <span
              className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
              style={{ borderColor: t.bg, ["--b" as string]: t.bg }}
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
