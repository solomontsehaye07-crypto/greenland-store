"use client";

import { useEffect } from "react";

// Pop-up menus built with <details data-dismiss> close when you tap or click anywhere outside them,
// or press Escape – like a normal menu.
export function DetailsDismiss() {
  useEffect(() => {
    const close = (keep?: Node | null) => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-dismiss][open]").forEach((d) => {
        if (!keep || !d.contains(keep)) d.open = false;
      });
    };
    const onDown = (e: PointerEvent) => close(e.target as Node);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
