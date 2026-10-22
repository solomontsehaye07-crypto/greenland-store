"use client";

import { useEffect, useRef, useState } from "react";

import type { VideoSource } from "@/lib/video";

const T = {
  de: { sound: "Ton an", mute: "Ton aus", pause: "Video anhalten", play: "Video abspielen", load: (s: string) => `Video von ${s} abspielen`, note: (s: string) => `Beim Abspielen wird eine Verbindung zu ${s} hergestellt.` },
  en: { sound: "Sound on", mute: "Sound off", pause: "Pause video", play: "Play video", load: (s: string) => `Play video from ${s}`, note: (s: string) => `Playing connects to ${s}.` },
};

/** Uploaded file: muted autoplay loop (paused while off screen); YouTube/Instagram: two-click embed. */
export function StoreVideo({ source, poster, title, lang }: { source: VideoSource; poster?: string; title: string; lang: "de" | "en" }) {
  const t = T[lang];
  if (source.kind === "file") return <FileVideo src={source.src} poster={poster} title={title} t={t} />;
  return <EmbedVideo source={source} poster={poster} title={title} t={t} />;
}

function FileVideo({ src, poster, title, t }: { src: string; poster?: string; title: string; t: (typeof T)["de"] }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCalm(reduce);
    if (reduce) {
      v.pause();
      setPaused(true);
      return;
    }
    // play only while visible, to save data and battery on phones
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !v.dataset.userPaused) v.play().catch(() => setPaused(true));
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      delete v.dataset.userPaused;
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.dataset.userPaused = "1";
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted={muted}
        loop
        playsInline
        autoPlay={!calm}
        preload="metadata"
        aria-label={title}
        className="aspect-video w-full object-cover"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button type="button" onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/70" aria-label={paused ? t.play : t.pause}>
          {paused ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            v.muted = !muted;
            setMuted(!muted);
            if (v.paused) toggle();
          }}
          className="flex h-10 items-center gap-2 rounded-full bg-black/55 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/70"
          aria-pressed={!muted}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
            {muted ? <path d="m16 9 5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
          </svg>
          {muted ? t.sound : t.mute}
        </button>
      </div>
    </div>
  );
}

function EmbedVideo({ source, poster, title, t }: { source: Exclude<VideoSource, { kind: "file" }>; poster?: string; title: string; t: (typeof T)["de"] }) {
  const [on, setOn] = useState(false);
  const yt = source.kind === "youtube";
  const site = yt ? "YouTube" : "Instagram";
  // no YouTube thumbnail before the click: that alone would already connect to Google
  const cover = poster || "";
  const src = yt
    ? `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&mute=1&loop=1&playlist=${source.id}&playsinline=1&rel=0&modestbranding=1`
    : `https://www.instagram.com/${source.path}/embed`;
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-ink ${yt ? "aspect-video" : "mx-auto aspect-[9/14] max-w-sm"}`}>
      {on ? (
        <iframe src={src} title={title} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-80" loading="lazy" />
          )}
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/90 text-ink shadow-lg transition-transform group-hover:scale-105">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </span>
          <span className="relative text-sm font-semibold drop-shadow">{t.load(site)}</span>
          <span className="relative max-w-xs px-4 text-center text-xs text-white/80 drop-shadow">{t.note(site)}</span>
        </button>
      )}
    </div>
  );
}
