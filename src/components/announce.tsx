"use client";

import { useEffect, useState } from "react";

export function Announce({ items }: { items: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div className="bg-ink px-4 py-2 text-center text-[0.8rem] font-medium text-paper" aria-live="polite">
      <span key={i} className="inline-block animate-[rise_.5s_ease-out_both]">{items[i]}</span>
    </div>
  );
}
