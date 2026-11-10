/**
 * Tells the server a public page was viewed, for the private visit counter (no cookies, nothing personal).
 * Failures are ignored: counting must never get in the way of the app.
 */
let last = "";
let lastAt = 0;

function pageOf(pathname: string): { page: string; listing_id?: string } | null {
  if (pathname.startsWith("/admin")) return null; // founders aren't visitors
  const listing = pathname.match(/^\/p\/([0-9a-fA-F-]{36})/);
  if (listing) return { page: "listing", listing_id: listing[1] };
  if (pathname === "/") return { page: "home" };
  if (pathname.startsWith("/sell")) return { page: "sell" };
  if (pathname.startsWith("/map")) return { page: "map" };
  if (pathname.startsWith("/me")) return { page: "profile" };
  if (pathname === "/terms" || pathname === "/privacy") return { page: "legal" };
  return { page: "other" };
}

export function trackView(pathname: string) {
  const view = pageOf(pathname);
  if (!view) return;
  const now = Date.now();
  if (pathname === last && now - lastAt < 2000) return; // same page counted twice in a row (e.g. a re-render)
  last = pathname;
  lastAt = now;
  const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  fetch(BASE + "/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(view),
    keepalive: true,
  }).catch(() => {});
}
