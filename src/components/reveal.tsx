"use client";

import { useEffect } from "react";

/** Marks every `.reveal` element as shown the first time it scrolls into view. Mounted once in the shop layout. */
export function RevealOnScroll() {
  useEffect(() => {
    // .reveal = whole sections; .reveal-item = cards, which come in one after another (--i = place in the batch)
    const els = () => Array.from(document.querySelectorAll<HTMLElement>(".reveal:not([data-shown='true']), .reveal-item:not([data-shown='true'])"));
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els().forEach((e) => (e.dataset.shown = "true"));
      return;
    }
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        let i = 0;
        entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
          .forEach((e) => {
            const el = e.target as HTMLElement;
            if (el.classList.contains("reveal-item")) el.style.setProperty("--i", String(Math.min(i++, 8)));
            el.dataset.shown = "true";
            io.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    const observe = () =>
      els().forEach((e) => {
        if (seen.has(e)) return;
        seen.add(e);
        io.observe(e);
      });
    observe();
    // pick up sections and cards rendered after navigation or "show more"
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}

/** Adds a soft shadow to the sticky header once the page has scrolled. */
export function HeaderScroll() {
  useEffect(() => {
    const h = document.querySelector<HTMLElement>(".site-header");
    if (!h) return;
    const on = () => (h.dataset.scrolled = String(window.scrollY > 8));
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return null;
}
