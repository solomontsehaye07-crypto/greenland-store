"use client";

import { useEffect, useState } from "react";

export function Announce({ items }: { items: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div className="bg-forest px-4 py-1.5 text-center text-[0.75rem] text-white/95" aria-live="polite">
      <span key={i} className="inline-block animate-[fade_.6s_ease-out_both]">{items[i]}</span>
    </div>
  );
}
