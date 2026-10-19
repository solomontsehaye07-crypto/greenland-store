"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Landing page for the sign-in email link. Supabase puts the session in the link itself
// (#access_token=…), so this works on any device or browser, not only the one that asked for the email.
export default function ConfirmSignIn() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    const failure = hash.get("error_description") ?? query.get("error_description");
    if (!access_token || !refresh_token) {
      setError(failure ?? "This sign-in link is incomplete or has already been used.");
      return;
    }
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    sb.auth.setSession({ access_token, refresh_token }).then(({ error: e }) => {
      if (e) setError("That sign-in link didn't work or has expired.");
      else window.location.replace("/admin");
    });
  }, []);

  return (
    <div className="mx-auto max-w-sm px-4 pt-24">
      <h1 className="text-3xl font-extrabold">{error ? "Sign-in failed" : "Signing you in…"}</h1>
      {error && (
        <p className="mt-3 text-sm text-danger">
          {error}{" "}
          <a className="text-green underline" href="/admin/login">
            Request a new link
          </a>
        </p>
      )}
    </div>
  );
}
