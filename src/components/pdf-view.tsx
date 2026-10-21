"use client";

import { useEffect, useRef, useState } from "react";
import { loadPoPdf } from "@/lib/po-pdf-client";

// Shows a PDF inside the app (no new browser tab): every page is drawn as a sharp image that fits the
// screen width. Pinch to zoom works as on any page. "Share" hands the real PDF file to WhatsApp, Mail …

export function PdfView({ src, filename, poId }: { src?: string; filename: string; poId?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [why, setWhy] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let buf: ArrayBuffer;
        if (poId) {
          // built here on the device from the request's data
          const r = await loadPoPdf(poId);
          buf = r.bytes.slice().buffer as ArrayBuffer;
        } else {
          const res = await fetch(src!, { cache: "no-store" });
          if (!res.ok) throw new Error(`The server answered ${res.status}.`);
          buf = await res.arrayBuffer();
        }
        if (cancelled) return;
        setFile(new File([buf], filename, { type: "application/pdf" }));
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
        const el = box.current;
        if (!el || cancelled) return;
        el.replaceChildren();
        const width = el.clientWidth;
        const ratio = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.style.width = "100%";
          canvas.className = "block rounded-lg bg-white shadow-md";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `Page ${n} of ${doc.numPages}`);
          el.appendChild(canvas);
          await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          if (cancelled) return;
        }
        setState("ready");
      } catch (e) {
        if (!cancelled) {
          setWhy((e as Error).message);
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, filename, poId]);

  const share = async () => {
    if (!file) return;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename });
      } catch {
        /* closed */
      }
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button type="button" onClick={share} disabled={!file} className="btn btn-primary flex-1">Share or save the PDF</button>
      </div>
      {state === "loading" && <p className="py-10 text-center text-sm text-muted" role="status">Loading the PDF…</p>}
      {state === "error" && <p className="rounded-xl border border-line bg-white p-4 text-sm text-danger" role="alert">The PDF could not be shown. {why}</p>}
      <div ref={box} className="space-y-3" />
    </div>
  );
}
