// Turns a product photo (often a tall 9:16 or 3:4 phone shot) into a clean square (1:1) shop image.
// 1. Finds the product by looking for edges/detail on a small copy of the photo (smooth backdrops have none).
// 2. If the product fits in a square, cuts a full-bleed square centred on it: no bars at all.
// 3. If the product is too tall/wide for that (e.g. a tall bottle), fits the product area into the square and
//    fills the sides by stretching the photo's own outermost pixels, so the backdrop just continues.
// 4. Busy photos (detail right up to the edges, which would streak) get a plain square crop.
// Only images from this shop's SellDone CDN folder are accepted.
import { Image, decode } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const ALLOWED = "https://cdn.selldone.com/app/shops/15718/";
const SIZE = 1200;
const PAD = 0.06; // breathing room kept around the product, as a share of the square side

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// bounding box of the area with visible detail, in source pixels
function findProduct(img: Image) {
  const sw = 64, sh = Math.max(8, Math.round((64 * img.height) / img.width));
  const s = img.clone().resize(sw, sh);
  const lum = (x: number, y: number) => {
    const c = s.getPixelAt(x, y);
    return ((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255);
  };
  const rows = new Array(sh).fill(0), cols = new Array(sw).fill(0);
  for (let y = 2; y < sh; y++) for (let x = 2; x < sw; x++) {
    const g = Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
    if (g > 60) { rows[y - 1]++; cols[x - 1]++; }
  }
  // share of detail along the outer edges: high means stretching them would look streaky
  const sideDetail = (cols[1] + cols[2] + cols[sw - 2] + cols[sw - 3]) / (4 * sh);
  const endDetail = (rows[1] + rows[2] + rows[sh - 2] + rows[sh - 3]) / (4 * sw);
  // main block of rows/columns with detail; small gaps are bridged, stray specks elsewhere are ignored
  const span = (a: number[]) => {
    const th = Math.max(2, Math.max(...a) * 0.12);
    let best: number[] | null = null, cur: number[] | null = null, gap = 0;
    const close = () => { if (cur && (!best || cur[2] > best[2])) best = cur; cur = null; };
    a.forEach((v, i) => {
      if (v >= th) { if (!cur) cur = [i, i, 0]; cur[1] = i; cur[2] += v; gap = 0; }
      else if (cur && ++gap > 8) { close(); gap = 0; }
    });
    close();
    return best ? [best[0], best[1] + 1] : null;
  };
  const ry = span(rows), rx = span(cols);
  if (!ry || !rx) return null;
  const fx = img.width / sw, fy = img.height / sh;
  return { x0: rx[0] * fx, x1: rx[1] * fx, y0: ry[0] * fy, y1: ry[1] * fy, sideDetail, endDetail };
}

export function squareImage(img: Image): Image {
  const W = img.width, H = img.height, side = Math.min(W, H), long = Math.max(W, H), portrait = H >= W;
  const box = findProduct(img) ?? { x0: 0, x1: W, y0: 0, y1: H, sideDetail: 1, endDetail: 1 };
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const need = Math.max(box.x1 - box.x0, box.y1 - box.y0) / (1 - 2 * PAD);
  const busy = (portrait ? box.sideDetail : box.endDetail) > 0.12;

  if (need <= side || busy) {
    // full-bleed square crop centred on the product; small products get a gentle zoom (up to 1.33x)
    const sq = busy ? side : Math.round(clamp(need, side * 0.75, side));
    const x = Math.round(clamp(cx - sq / 2, 0, W - sq));
    const y = Math.round(clamp(cy - sq / 2, 0, H - sq));
    return img.crop(x, y, sq, sq).resize(SIZE, SIZE, Image.RESIZE_BILINEAR);
  }

  // product too long for a square: keep the product area, continue the backdrop sideways
  const len = Math.min(long, Math.round(need));
  if (portrait) img.crop(0, Math.round(clamp(cy - len / 2, 0, H - len)), W, len);
  else img.crop(Math.round(clamp(cx - len / 2, 0, W - len)), 0, W === long ? len : W, H);
  const scale = SIZE / Math.max(img.width, img.height);
  const fg = img.resize(Math.round(img.width * scale), Math.round(img.height * scale), Image.RESIZE_BILINEAR);
  const out = new Image(SIZE, SIZE);
  // a soft, averaged copy of the outer pixels: texture is smoothed so the extension shows no streaks
  const edge = (x: number, y: number, w: number, h: number, bw: number, bh: number) => {
    const e = fg.clone().crop(x, y, w, h);
    return portrait
      ? e.resize(1, h).resize(1, Math.max(1, Math.round(h / 24))).resize(bw, bh, Image.RESIZE_BILINEAR)
      : e.resize(w, 1).resize(Math.max(1, Math.round(w / 24)), 1).resize(bw, bh, Image.RESIZE_BILINEAR);
  };
  if (portrait) {
    const band = Math.ceil((SIZE - fg.width) / 2);
    out.composite(edge(0, 0, 12, fg.height, band, fg.height), 0, 0);
    out.composite(edge(fg.width - 12, 0, 12, fg.height, band, fg.height), SIZE - band, 0);
    out.composite(fg, Math.round((SIZE - fg.width) / 2), 0);
  } else {
    const band = Math.ceil((SIZE - fg.height) / 2);
    out.composite(edge(0, 0, fg.width, 12, fg.width, band), 0, 0);
    out.composite(edge(0, fg.height - 12, fg.width, 12, fg.width, band), 0, SIZE - band);
    out.composite(fg, 0, Math.round((SIZE - fg.height) / 2));
  }
  return out;
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    const src = new URL(req.url).searchParams.get("src") ?? "";
    if (!src.startsWith(ALLOWED)) return new Response("src not allowed", { status: 400 });
    const res = await fetch(src);
    if (!res.ok) return new Response("source not found", { status: 404 });
    const img = (await decode(new Uint8Array(await res.arrayBuffer()))) as Image;
    return new Response(await squareImage(img).encodeJPEG(88), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
}
