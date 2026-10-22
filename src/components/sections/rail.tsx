"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../icons";

/**
 * Auto-scroll styles for a row of cards. All of them stop the moment someone touches, hovers or focuses the
 * row, pick up again a few seconds later, only run while the row is on screen, and never run when the
 * phone asks for reduced motion.
 *  - step: moves on by one card every few seconds, then glides back to the start
 *  - back: the same, starting at the end and moving the other way
 *  - glide: drifts slowly and continuously, turning round at each end
 */
export type RailMotion = "off" | "step" | "back" | "glide";

const STEP_MS = 3800;
const IDLE_MS = 5000;
const GLIDE_PX_PER_S = 22;

/** The auto-scroll behaviour on any horizontally scrolling element. */
export function useAutoScroll(ref: React.RefObject<HTMLElement | null>, motion: RailMotion) {
  useEffect(() => {
    const el = ref.current;
    if (!el || motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let hovering = false; // a mouse resting on the row (touch has no lasting hover)
    let pausedUntil = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let raf = 0;
    let dir = motion === "back" ? -1 : 1;
    const max = () => el.scrollWidth - el.clientWidth;
    if (max() <= 4) return;
    const busy = () => !visible || hovering || document.hidden || Date.now() < pausedUntil;
    const hold = () => (pausedUntil = Date.now() + IDLE_MS);
    const card = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
      return (first?.offsetWidth ?? el.clientWidth * 0.8) + gap;
    };

    if (motion === "back") el.scrollLeft = max();

    if (motion === "glide") {
      el.classList.add("rail-glide"); // scroll-snap would swallow the tiny steps
      let last = performance.now();
      let pos = el.scrollLeft;
      const tick = (now: number) => {
        const dt = Math.min(64, now - last);
        last = now;
        if (busy()) pos = el.scrollLeft;
        else {
          pos += dir * (GLIDE_PX_PER_S * dt) / 1000;
          if (pos >= max()) [pos, dir] = [max(), -1];
          if (pos <= 0) [pos, dir] = [0, 1];
          el.scrollLeft = pos;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      timer = setInterval(() => {
        if (busy()) return;
        const atEnd = dir > 0 ? el.scrollLeft >= max() - 4 : el.scrollLeft <= 4;
        if (atEnd) el.scrollTo({ left: dir > 0 ? 0 : max(), behavior: "smooth" });
        else el.scrollBy({ left: dir * card(), behavior: "smooth" });
      }, STEP_MS);
    }

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    const events = ["pointerdown", "wheel", "touchstart", "focusin", "keydown"] as const;
    events.forEach((ev) => el.addEventListener(ev, hold, { passive: true }));
    const enter = (e: PointerEvent) => { if (e.pointerType === "mouse") hovering = true; };
    const leave = (e: PointerEvent) => { if (e.pointerType === "mouse") { hovering = false; hold(); } };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
      cancelAnimationFrame(raf);
      el.classList.remove("rail-glide");
      events.forEach((ev) => el.removeEventListener(ev, hold));
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, [motion]);
}

/** A plain list that scrolls sideways (e.g. offers on phones) with the same auto-scroll. */
export function AutoScrollList({ motion = "step", className, children }: { motion?: RailMotion; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useAutoScroll(ref, motion);
  return <ul ref={ref} className={className}>{children}</ul>;
}

export function Rail({ children, labels, motion = "off" }: { children: React.ReactNode; labels: { prev: string; next: string }; motion?: RailMotion }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  useAutoScroll(ref, motion);


  return (
    <div className="group/rail relative">
      <div ref={ref} className="rail">{children}</div>
      <button type="button" onClick={() => go(-1)} aria-label={labels.prev} className="absolute -left-3 top-[34%] hidden h-9 w-9 place-items-center rounded-full border border-line bg-white opacity-0 shadow-sm transition-opacity group-hover/rail:opacity-100 focus-visible:opacity-100 lg:grid"><Icon name="arrowL" size={16} /></button>
      <button type="button" onClick={() => go(1)} aria-label={labels.next} className="absolute -right-3 top-[34%] hidden h-9 w-9 place-items-center rounded-full border border-line bg-white opacity-0 shadow-sm transition-opacity group-hover/rail:opacity-100 focus-visible:opacity-100 lg:grid"><Icon name="arrowR" size={16} /></button>
    </div>
  );
}
