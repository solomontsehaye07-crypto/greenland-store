"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Reading lens: a round lens you drag (finger) or move (mouse) over the page. Whatever is under it –
// text, a button, a field, an icon's label – is shown very large and with strong contrast above it.

const MAX = 220;

function readAt(x: number, y: number): string {
  // skip the lens and reading box themselves
  const el = (document.elementsFromPoint(x, y) as HTMLElement[]).find((e) => !e.closest("[data-lens]")) ?? null;
  if (!el) return "";
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const label = el.labels?.[0]?.innerText ?? el.getAttribute("aria-label") ?? "";
    return [label, el.value || el.placeholder].filter(Boolean).join(": ");
  }
  if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.text ?? "";
  if (el instanceof HTMLImageElement) return el.alt;
  // the smallest element around the point that has some text
  let n: HTMLElement | null = el;
  for (let i = 0; n && i < 6; i++, n = n.parentElement) {
    const t = (n.innerText || n.getAttribute("aria-label") || n.getAttribute("title") || "").trim();
    if (t) return t.replace(/\s+\n/g, "\n").slice(0, MAX) + (t.length > MAX ? " …" : "");
  }
  return "";
}

export function MagnifierToggle({ className = "", label = "Reading lens" }: { className?: string; label?: string }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        aria-label={on ? "Close the reading lens" : label}
        title={label}
        className={`grid h-11 w-11 place-items-center rounded-xl ${on ? "bg-ink text-white" : "hover:bg-surface"} ${className}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21M8 10.5h5M10.5 8v5" />
        </svg>
      </button>
      {on && <Lens onClose={() => setOn(false)} />}
    </>
  );
}

function Lens({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState(() => ({ x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) }));
  const [text, setText] = useState("");
  const dragging = useRef(false);
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const R = 44; // lens radius

  const update = useCallback((x: number, y: number) => {
    const nx = Math.min(Math.max(x, R), window.innerWidth - R);
    const ny = Math.min(Math.max(y, R + 8), window.innerHeight - R);
    setPos({ x: nx, y: ny });
    setText(readAt(nx, ny));
  }, []);

  useEffect(() => {
    update(pos.x, pos.y);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // mouse: the lens simply follows the pointer
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || dragging.current) update(e.clientX, e.clientY);
    };
    const onUp = () => (dragging.current = false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reading box above the lens, or below when the lens is near the top
  const above = pos.y > window.innerHeight * 0.42;
  const boxStyle: React.CSSProperties = above
    ? { bottom: window.innerHeight - pos.y + R + 12 }
    : { top: pos.y + R + 12 };

  return createPortal(
    <div data-lens data-no-translate className="pointer-events-none fixed inset-0 z-[100]" aria-live="polite">
      {/* reading box */}
      <div
        className="pointer-events-auto fixed left-3 right-3 mx-auto max-w-xl rounded-2xl border-4 border-[#e5a532] bg-[#111] px-4 py-3 text-white shadow-2xl"
        style={boxStyle}
      >
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 whitespace-pre-line break-words text-[1.75rem] font-bold leading-tight" style={{ fontFamily: '"Noto Sans Ethiopic", system-ui, sans-serif' }}>
            {text || (touch ? "Drag the lens over text" : "Move the mouse over text")}
          </p>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-xl font-bold text-black" aria-label="Close the reading lens">
            ✕
          </button>
        </div>
      </div>
      {/* the lens */}
      <div
        role="slider"
        aria-label="Reading lens – drag over text"
        aria-valuetext={text}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          e.preventDefault();
        }}
        className="pointer-events-auto fixed touch-none rounded-full border-4 border-[#e5a532] bg-white/10 shadow-[0_0_0_3px_rgba(0,0,0,.6),0_10px_30px_rgba(0,0,0,.35)] backdrop-brightness-110"
        style={{ left: pos.x - R, top: pos.y - R, width: R * 2, height: R * 2, cursor: touch ? "grab" : "none" }}
      >
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e5a532]" aria-hidden />
        {touch && <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">drag me</span>}
      </div>
    </div>,
    document.body
  );
}
