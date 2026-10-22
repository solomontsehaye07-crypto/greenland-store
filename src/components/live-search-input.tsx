"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

/**
 * A search input for list pages (Admin, Manager): the list updates while you type, no button press needed.
 * It submits its own form as a GET request – keeping the form's other fields (category, filters …) – a moment
 * after typing stops.
 */
export function LiveSearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const router = useRouter();
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <input
      {...props}
      autoComplete="off"
      onChange={(e) => {
        props.onChange?.(e);
        const input = e.currentTarget;
        const form = input.form;
        clearTimeout(timer.current);
        const v = input.value.trim();
        if (v.length === 1) return; // wait for a second letter
        timer.current = setTimeout(() => {
          const data = form ? new FormData(form) : new FormData();
          if (!form) data.set(input.name, input.value);
          const qs = new URLSearchParams();
          data.forEach((val, key) => {
            if (typeof val === "string" && val !== "" && key !== "page") qs.set(key, val);
          });
          const raw = form?.getAttribute("action");
          const base = raw && raw.startsWith("/") ? raw : path;
          router.replace(`${base}${qs.size ? `?${qs}` : ""}`, { scroll: false });
        }, 350);
      }}
    />
  );
}
