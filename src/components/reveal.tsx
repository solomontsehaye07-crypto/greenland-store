"use client";

import { useEffect } from "react";

/** Marks every `.reveal` element as shown the first time it scrolls into view. Mounted once in the shop layout. */
export function RevealOnScroll() {
  useEffect(() => {
    const els = () => Array.from(document.querySelectorAll<HTMLElement>(".reveal:not([data-shown='true'])"));
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els().forEach((e) => (e.dataset.shown = "true"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).dataset.shown = "true";
          io.unobserve(e.target);
        }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    const observe = () => els().forEach((e) => io.observe(e));
    observe();
    // pick up sections rendered after navigation
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
