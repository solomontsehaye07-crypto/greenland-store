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
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="display text-4xl font-extrabold sm:text-5xl" style={{ textWrap: "balance" }}>{tx(page.title, lang)}</h1>
      <div className="weave-thin my-8 w-24" aria-hidden />
      <Markdown text={tx(page.body, lang)} className="text-[1.05rem]" />
    </article>
  );
}
