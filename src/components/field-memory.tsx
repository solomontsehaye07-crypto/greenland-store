"use client";

import { useEffect } from "react";

// Remembers what was typed into the fields of the admin and the Manager app and offers it again
// as suggestions (the browser's own dropdown, via <datalist>). Works for every form without
// changing it: values are saved per field name on this device; some fields also get suggestions
// from existing data (brands, countries, suppliers, carriers, units …) from /api/admin/suggest.
// Passwords, keys, codes, IBANs and similar fields are never stored.

const KEEP = 12;
const SKIP_TYPES = new Set(["password", "hidden", "checkbox", "radio", "file", "submit", "button", "reset", "image", "color", "range", "date", "time", "datetime-local", "month", "week"]);
const SKIP_NAME = /pass|secret|key|token|iban|bic|^code$|otp|__clear|card|cvc|^q$/i;

type Field = HTMLInputElement;

function eligible(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLInputElement)) return false;
  if (SKIP_TYPES.has(el.type) || el.readOnly || el.disabled) return false;
  if (el.dataset.noMemory !== undefined) return false;
  if ((el.getAttribute("autocomplete") ?? "").includes("one-time-code")) return false;
  const name = el.name || el.id;
  if (!name || SKIP_NAME.test(name)) return false;
  const own = el.getAttribute("list");
  return !own || own.startsWith("fm-");
}

const keyOf = (el: Field) => `fm:${el.name || el.id}`;

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function remember(el: Field) {
  const v = el.value.trim();
  if (!v || v.length > 200) return;
  const key = keyOf(el);
  const list = [v, ...read(key).filter((x) => x !== v)].slice(0, KEEP);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

let seeds: Record<string, string[]> | null = null;
let seeding: Promise<void> | null = null;
function loadSeeds(endpoint: string) {
  seeding ??= fetch(endpoint, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => {
      seeds = d && typeof d === "object" ? (d as Record<string, string[]>) : {};
    })
    .catch(() => {
      seeds = {};
    });
  return seeding;
}

function attach(el: Field) {
  const name = el.name || el.id;
  const values = [...read(keyOf(el)), ...(seeds?.[name] ?? [])].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 40);
  const id = `fm-${name.replace(/[^\w-]/g, "_")}`;
  let dl = document.getElementById(id) as HTMLDataListElement | null;
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = id;
    document.body.appendChild(dl);
  }
  dl.replaceChildren(...values.filter((v) => v !== el.value).map((v) => Object.assign(document.createElement("option"), { value: v })));
  el.setAttribute("list", id);
  if (!el.getAttribute("autocomplete")) el.setAttribute("autocomplete", "on");
}

export function FieldMemory({ seedsUrl }: { seedsUrl?: string }) {
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (!eligible(el)) return;
      attach(el);
      if (seedsUrl && !seeds) loadSeeds(seedsUrl).then(() => document.activeElement === el && attach(el));
    };
    const onChange = (e: Event) => {
      if (eligible(e.target)) remember(e.target);
    };
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      for (const el of Array.from(f.elements ?? [])) if (eligible(el)) remember(el);
    };
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [seedsUrl]);
  return null;
}
