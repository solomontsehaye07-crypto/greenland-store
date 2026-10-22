// Video links for website sections: an uploaded file, a YouTube or an Instagram link.

export type VideoSource =
  | { kind: "file"; src: string }
  | { kind: "youtube"; id: string }
  | { kind: "instagram"; path: string };

/** Turns what the owner pasted or uploaded into something we can play. */
export function parseVideo(raw: unknown): VideoSource | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return ytId(u.pathname.slice(1));
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] || "";
    return ytId(id);
  }
  if (host === "instagram.com") {
    const m = u.pathname.match(/^\/(reel|reels|p|tv)\/([\w-]+)/);
    return m ? { kind: "instagram", path: `${m[1] === "reels" ? "reel" : m[1]}/${m[2]}` } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", src: u.toString() };
  return null;
}
const ytId = (id: string): VideoSource | null => (/^[\w-]{6,20}$/.test(id) ? { kind: "youtube", id } : null);

