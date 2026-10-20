"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePage } from "../../actions";
import { pageHref } from "../slugs";

export type PageRow = { slug: string; title: { de?: string; en?: string }; body: { de?: string; en?: string }; published: boolean; show_in_footer: boolean; sort: number };

export function PageForm({ page }: { page: PageRow }) {
  const [state, action, pending] = useActionState(savePage.bind(null, page.slug), null);
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <fieldset>
          <legend className="label">Title</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label htmlFor="t-de" className="mb-1 block text-xs font-medium text-muted">Deutsch</label><input id="t-de" name="title_de" defaultValue={page.title?.de ?? ""} className="input" /></div>
            <div><label htmlFor="t-en" className="mb-1 block text-xs font-medium text-muted">English</label><input id="t-en" name="title_en" defaultValue={page.title?.en ?? ""} className="input" /></div>
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Text</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label htmlFor="b-de" className="mb-1 block text-xs font-medium text-muted">Deutsch</label><textarea id="b-de" name="body_de" rows={18} defaultValue={page.body?.de ?? ""} className="input leading-relaxed" /></div>
            <div><label htmlFor="b-en" className="mb-1 block text-xs font-medium text-muted">English</label><textarea id="b-en" name="body_en" rows={18} defaultValue={page.body?.en ?? ""} className="input leading-relaxed" /></div>
          </div>
          <p className="mt-1 text-xs text-muted">Formatting: ## heading, **bold**, *italic*, - list item, [link text](/c/food). Leave an empty line between paragraphs.</p>
        </fieldset>
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" name="published" defaultChecked={page.published} className="h-5 w-5 accent-[var(--forest)]" /><span className="text-sm font-semibold">Published</span></label>
          <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" name="show_in_footer" defaultChecked={page.show_in_footer} className="h-5 w-5 accent-[var(--forest)]" /><span className="text-sm font-semibold">Show in footer</span></label>
          <div><label htmlFor="sort" className="label">Order in footer</label><input id="sort" name="sort" type="number" defaultValue={page.sort} className="input w-28" /></div>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 backdrop-blur">
        <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save page"}</button>
        <Link href={pageHref(page.slug)} target="_blank" className="text-sm font-semibold underline underline-offset-2">View on site</Link>
        <span className="text-sm" role="status" aria-live="polite">
          {state?.error && <span className="text-danger">{state.error}</span>}
          {state?.ok && <span className="font-semibold text-forest">{state.ok}</span>}
        </span>
      </div>
    </form>
  );
}
