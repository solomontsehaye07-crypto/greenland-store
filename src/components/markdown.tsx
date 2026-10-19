import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Small, safe markdown renderer for shop texts: headings (#, ##, ###), paragraphs, bullet and numbered
// lists, **bold**, *italic* and [links](/path). No raw HTML is ever rendered.

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("[")) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      const safe = /^(https?:\/\/|\/|mailto:|tel:|#)/.test(href) ? href : "#";
      out.push(
        safe.startsWith("/") ? (
          <Link key={k} href={safe} className="underline decoration-2 underline-offset-2">
            {label}
          </Link>
        ) : (
          <a key={k} href={safe} className="underline decoration-2 underline-offset-2" rel="noopener">
            {label}
          </a>
        )
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = (text ?? "").replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={`prose-shop ${className}`}>
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim() !== "");
        if (!lines.length) return null;
        const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
        if (h && lines.length === 1) {
          const level = h[1].length;
          const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2";
          return <Tag key={bi}>{inline(h[2], `h${bi}`)}</Tag>;
        }
        if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `u${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return (
            <ol key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `o${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `p${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
