"use client";

import { useEffect } from "react";
import base from "@/lib/admin-i18n/ti.json";

// Shows the admin in Tigrinya without touching what customers, suppliers or the tax advisor receive:
// only the text on the admin screens is replaced in the browser. Emails, PDFs, receipts, reports and
// the shop itself are created on the server and stay in English/German.

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "OPTION_SKIP"]);
const ATTRS = ["placeholder", "title", "aria-label"];
const LATIN = /[A-Za-z]{2}/;
const NUM = /\d+(?:[.,]\d+)*/g;
const MISSING_KEY = "gl.admin.ti.missing";

export function AdminTranslator({ lang, overrides }: { lang: string; overrides: Record<string, string> }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".admin");
    if (!root) return;
    if (lang !== "ti") {
      root.dataset.ready = "1";
      return;
    }
    const dict: Record<string, string> = { ...(base as Record<string, string>), ...overrides };
    // templates: "12 products" is looked up as "{0} products"
    const missing = new Set<string>();
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(MISSING_KEY) ?? "[]");
    } catch {
      stored = [];
    }

    const lookup = (raw: string): string | null => {
      const t = raw.trim();
      if (!t || !LATIN.test(t)) return null;
      if (dict[t]) return dict[t];
      const nums: string[] = [];
      const tpl = t.replace(NUM, (m) => `{${nums.push(m) - 1}}`);
      if (nums.length && dict[tpl]) return dict[tpl].replace(/\{(\d+)\}/g, (_, i) => nums[Number(i)] ?? "");
      // "Label:" or "Label…" – translate the label part
      const m = t.match(/^(.*?)([:…·]+)$/);
      if (m && dict[m[1].trim()]) return dict[m[1].trim()] + m[2];
      if (t.length < 160 && !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t) && !/^(GRL|PO)-\d+/.test(t)) missing.add(t);
      return null;
    };

    const done = new WeakSet<Node>();
    const translateText = (n: Text) => {
      if (done.has(n)) return;
      const v = n.nodeValue ?? "";
      const tr = lookup(v);
      if (tr) {
        const lead = v.match(/^\s*/)?.[0] ?? "";
        const trail = v.match(/\s*$/)?.[0] ?? "";
        n.nodeValue = lead + tr + trail;
      }
      done.add(n);
    };
    const translateEl = (el: Element) => {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v) {
          const tr = lookup(v);
          if (tr) el.setAttribute(a, tr);
        }
      }
      if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button") && el.value) {
        const tr = lookup(el.value);
        if (tr) el.value = tr;
      }
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) return translateText(node as Text);
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (SKIP.has(el.tagName) || el.closest("[data-no-translate],[contenteditable=true]")) return;
      translateEl(el);
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (x) => {
          if (x.nodeType === Node.ELEMENT_NODE) {
            const e = x as Element;
            if (SKIP.has(e.tagName) || e.hasAttribute("data-no-translate")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let x: Node | null;
      while ((x = tw.nextNode())) {
        if (x.nodeType === Node.TEXT_NODE) translateText(x as Text);
        else translateEl(x as Element);
      }
    };

    const saveMissing = () => {
      if (!missing.size) return;
      try {
        const all = Array.from(new Set([...stored, ...missing])).slice(-800);
        localStorage.setItem(MISSING_KEY, JSON.stringify(all));
        stored = all;
        missing.clear();
      } catch {
        /* storage unavailable */
      }
    };

    walk(root);
    root.dataset.ready = "1";
    saveMissing();

    let queued: Node[] = [];
    let frame = 0;
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          done.delete(r.target);
          queued.push(r.target);
        } else if (r.type === "attributes") queued.push(r.target);
        else r.addedNodes.forEach((n) => queued.push(n));
      }
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          const list = queued;
          queued = [];
          mo.disconnect();
          list.forEach(walk);
          saveMissing();
          observe();
        });
    });
    const observe = () => mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    observe();
    return () => mo.disconnect();
  }, [lang, overrides]);
  return null;
}
