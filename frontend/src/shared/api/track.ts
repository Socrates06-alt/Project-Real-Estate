/**
 * Private visit counter: tells the server a public page was viewed by a real person.
 * Not counted: founders' devices, automated browsers, admin pages, and pages left within 2 seconds.
 * No cookies, nothing personal. Failures are ignored: counting must never get in the way of the app.
 */
import { visitSource } from "@/shared/lib/source";

const FOUNDER_KEY = "landfinder.founderDevice";
const MIN_VIEW_MS = 2000; // a page counts once it has been on screen this long

let lastCounted = "";
let lastAt = 0;
let pending: ReturnType<typeof setTimeout> | undefined;

/** Called when a founder signs in to admin: this device is never counted again (even after signing out). */
export function markFounderDevice() {
  try {
    localStorage.setItem(FOUNDER_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

function isFounderDevice(): boolean {
  try {
    return localStorage.getItem(FOUNDER_KEY) === "1";
  } catch {
    return false;
  }
}

function pageOf(pathname: string): { page: string; listing_id?: string } | null {
  if (pathname.startsWith("/admin")) return null;
  const listing = pathname.match(/^\/p\/([0-9a-fA-F-]{36})/);
  if (listing) return { page: "listing", listing_id: listing[1] };
  if (pathname === "/") return { page: "home" };
  if (pathname.startsWith("/sell")) return { page: "sell" };
  if (pathname.startsWith("/map")) return { page: "map" };
  if (pathname.startsWith("/me")) return { page: "profile" };
  if (pathname === "/terms" || pathname === "/privacy") return { page: "legal" };
  return { page: "other" };
}

function send(view: { page: string; listing_id?: string }) {
  const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  fetch(BASE + "/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...view, source: visitSource() }),
    keepalive: true,
  }).catch(() => {});
}

export function trackView(pathname: string) {
  clearTimeout(pending); // moved on before 2 seconds: the previous page isn't counted
  const view = pageOf(pathname);
  if (!view || isFounderDevice() || navigator.webdriver) return;
  pending = setTimeout(() => {
    if (document.visibilityState !== "visible") return; // opened in the background, never seen
    const now = Date.now();
    if (pathname === lastCounted && now - lastAt < 5000) return; // same page again straight away
    lastCounted = pathname;
    lastAt = now;
    send(view);
  }, MIN_VIEW_MS);
}
