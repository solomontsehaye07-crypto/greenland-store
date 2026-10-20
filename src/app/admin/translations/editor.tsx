"use client";

import { useEffect, useMemo, useState } from "react";
import base from "@/lib/admin-i18n/ti.json";
import { saveTranslations } from "./actions";

const MISSING_KEY = "gl.admin.ti.missing";

export function TranslationEditor({ overrides }: { overrides: Record<string, string> }) {
  const dict = useMemo(() => ({ ...(base as Record<string, string>), ...overrides }), [overrides]);
  const [tab, setTab] = useState<"missing" | "all">("missing");
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ ok?: string; error?: string; busy?: boolean }>({});
  const [limit, setLimit] = useState(80);

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(MISSING_KEY) ?? "[]") as string[];
      setMissing(list.filter((s) => !dict[s]));
    } catch {
      setMissing([]);
    }
  }, [dict]);

  const keys = tab === "missing" ? missing : Object.keys(dict).sort((a, b) => a.localeCompare(b));
  const shown = keys.filter((k) => !q || k.toLowerCase().includes(q.toLowerCase()) || (dict[k] ?? "").includes(q));
  const changed = Object.keys(edits).length;

  return (
    <div className="space-y-4" data-no-translate>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface p-1 text-sm">
          <button type="button" onClick={() => setTab("missing")} className={`rounded-full px-3.5 py-1.5 font-medium ${tab === "missing" ? "bg-[var(--card)] shadow-sm" : "text-muted"}`}>Still in English ({missing.length})</button>
          <button type="button" onClick={() => setTab("all")} className={`rounded-full px-3.5 py-1.5 font-medium ${tab === "all" ? "bg-[var(--card)] shadow-sm" : "text-muted"}`}>All texts ({Object.keys(dict).length})</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search English or Tigrinya…" className="input h-10 max-w-xs py-2 text-sm" />
        <button
          type="button"
          disabled={!changed || state.busy}
          onClick={async () => {
            setState({ busy: true });
            const r = await saveTranslations(edits);
            setState(r);
            if (r.ok) {
              setEdits({});
              setMissing((m) => m.filter((k) => !edits[k]));
            }
          }}
          className="btn btn-primary ml-auto"
        >
          {state.busy ? "Saving…" : `Save ${changed || ""} change${changed === 1 ? "" : "s"}`}
        </button>
      </div>
      {state.ok && <p className="text-sm font-medium text-forest" role="status">{state.ok} Reload a page to see them.</p>}
      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {tab === "missing" && !missing.length && (
        <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">Nothing collected yet. Switch the admin to ትግርኛ (bottom of the menu) and use it as usual; any text that has no Tigrinya yet appears here on this device.</p>
      )}
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {shown.slice(0, limit).map((k) => (
          <li key={k} className="grid gap-2 px-4 py-3 md:grid-cols-2 md:gap-4">
            <p className="text-sm text-muted">{k}</p>
            <input
              lang="ti"
              value={edits[k] ?? dict[k] ?? ""}
              onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value }))}
              placeholder="ትግርኛ…"
              className="input py-2 text-sm"
              style={{ fontFamily: '"Noto Sans Ethiopic", system-ui, sans-serif' }}
            />
          </li>
        ))}
      </ul>
      {shown.length > limit && <button type="button" onClick={() => setLimit((l) => l + 120)} className="btn btn-ghost">Show more ({shown.length - limit} more)</button>}
    </div>
  );
}
