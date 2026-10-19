"use client";

import { useState } from "react";
import { DEFAULT_THEME, THEME_FIELDS } from "@/lib/sections";
import { FieldEditor } from "@/components/admin/website/field-editor";
import { saveTheme } from "../actions";

type T = Record<string, unknown>;
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);

export function ThemeForm({ initial }: { initial: T }) {
  const [t, setT] = useState<T>(initial);
  const c = (k: keyof typeof DEFAULT_THEME) => hex(t[k], String(DEFAULT_THEME[k]));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <FieldEditor fields={THEME_FIELDS} initial={initial} action={saveTheme} onChange={setT} resetTo={DEFAULT_THEME as unknown as T} />
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="label">Preview</p>
        <div className="overflow-hidden rounded-2xl ring-1 ring-line" style={{ background: c("paper"), color: c("ink") }}>
          {t.pattern !== false && (
            <div className="h-2" style={{ background: `repeating-linear-gradient(90deg, ${c("terra")} 0 14px, ${c("saffron")} 14px 28px, ${c("forest")} 28px 42px, ${c("indigo")} 42px 56px)` }} aria-hidden />
          )}
          <div className="space-y-3 p-5">
            <p className="display text-2xl font-extrabold leading-tight">A taste of home</p>
            <p className="text-sm opacity-75">Gari, palm oil, shea butter and jebena.</p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: c("terra") }}>Shop groceries</span>
              <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: c("forest") }}>Add to cart</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {(["terra", "saffron", "forest", "indigo"] as const).map((k) => (
                <div key={k} className="aspect-[4/5] rounded-t-full" style={{ background: c(k) }} title={k} />
              ))}
            </div>
            <div className="rounded-xl p-3 text-sm" style={{ background: c("sand") }}>Soft band colour, used behind product rows and stories.</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
