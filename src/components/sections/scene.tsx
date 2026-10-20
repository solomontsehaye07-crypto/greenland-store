import Link from "next/link";
import { tx, type L10n, type Lang } from "@/lib/i18n";
import { SceneSteps } from "./scene-steps";

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Scroll scene: full-screen photos stay still in the background while the text cards scroll over them.
 * Each card brings its own photo, which fades in as the card reaches the middle of the screen.
 */
export function Scene({ d, lang }: { d: D; lang: Lang }) {
  const steps = ((d.steps ?? []) as D[]).filter((s) => s.image);
  if (!steps.length) return null;
  const dim = Math.min(Math.max(Number(d.dim ?? 35), 0), 80) / 100;
  const side = d.align === "right" ? "right" : d.align === "center" ? "center" : "left";
  return (
    <SceneSteps images={steps.map((s) => s.image as string)} dim={dim}>
      {steps.map((s, i) => {
        const title = tx(s.title as L10n, lang);
        const text = tx(s.text as L10n, lang);
        const cta = tx(s.ctaLabel as L10n, lang);
        return (
          <div key={i} data-step={i} className={`scene-step scene-${side}`}>
            {(title || text || cta) && (
              <div className="scene-card">
                {title && <h2 className="display text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]" style={{ textWrap: "balance" }}>{title}</h2>}
                {text && <p className="mt-3 text-[0.9375rem] leading-relaxed opacity-85">{text}</p>}
                {cta && s.ctaHref && (
                  <Link href={s.ctaHref} className="btn btn-saffron mt-6 h-11 px-6">{cta}</Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </SceneSteps>
  );
}
