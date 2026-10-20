"use client";

import { useEffect, useRef, useState } from "react";

export function SceneSteps({ images, dim, children }: { images: string[]; dim: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step ?? 0));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    root.querySelectorAll("[data-step]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <section className="scene">
      <div className="scene-bg" aria-hidden>
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + i} src={src} alt="" loading={i === 0 ? "eager" : "lazy"} className="scene-img" style={{ opacity: i === active ? 1 : 0 }} />
        ))}
        <div className="absolute inset-0 bg-black" style={{ opacity: dim }} />
      </div>
      <div ref={ref} className="scene-fg">{children}</div>
    </section>
  );
}
