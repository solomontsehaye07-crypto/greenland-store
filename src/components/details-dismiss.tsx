"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Pop-up menus built with <details data-dismiss> close when you tap or click anywhere outside them,
// press Escape, tap a link inside them, or the page changes – like a normal menu.
// (The header stays mounted across page changes, so without this an open menu would cover the new page.)
const closeAll = (keep?: Node | null) => {
  document.querySelectorAll<HTMLDetailsElement>("details[data-dismiss][open]").forEach((d) => {
    if (!keep || !d.contains(keep)) d.open = false;
  });
};

export function DetailsDismiss() {
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => closeAll(), [path, search]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => closeAll(e.target as Node);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    // a tapped link inside an open menu: close it as the page starts to change
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a && a.closest("details[data-dismiss][open]")) closeAll();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
