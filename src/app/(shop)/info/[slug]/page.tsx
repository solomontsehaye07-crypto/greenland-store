import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPage } from "@/lib/content";
import { getLang, tx } from "@/lib/i18n";
import { Markdown } from "@/components/markdown";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const page = await getPage(slug);
  return { title: page ? tx(page.title, lang) : undefined };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const page = await getPage(slug);
  if (!page) notFound();
  if (page.image) {
    // a page with a photo (e.g. "Über uns"): portrait beside the story on large screens, above it on phones
    return (
      <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-14">
          <div className="md:sticky md:top-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.image} alt="" className="aspect-[4/5] w-full rounded-3xl bg-surface object-cover" />
          </div>
          <div className="max-w-xl">
            <h1 className="h-section text-[2.25rem] sm:text-[2.75rem]" style={{ textWrap: "balance" }}>{tx(page.title, lang)}</h1>
            <Markdown text={tx(page.body, lang)} className="about-body mt-6 text-[1.0625rem] leading-relaxed" />
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="h-section" style={{ textWrap: "balance" }}>{tx(page.title, lang)}</h1>
      <div className="my-6" />
      <Markdown text={tx(page.body, lang)} className="" />
    </article>
  );
}
