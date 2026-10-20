export const dynamic = "force-static";

export function GET() {
  return new Response(
    JSON.stringify({
      name: "Greenland Manager",
      short_name: "GL Manager",
      description: "Run Greenland Afro Asia Store: sales, orders, stock and store controls.",
      id: "/manager",
      start_url: "/manager",
      // whole site in scope so sign-in and the full admin stay inside the app window
      scope: "/",
      display: "standalone",
      background_color: "#121513",
      theme_color: "#1D5C3F",
      icons: [
        { src: "/brand/greenland-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/brand/greenland-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
