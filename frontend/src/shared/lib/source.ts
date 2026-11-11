/**
 * Where a visitor came from, for the private visitor counter and for requirements / visit requests.
 *
 * - The Facebook and Instagram apps open links in their own browser, which says so: detected automatically.
 * - Links can carry a label: landfinder.online/?from=ad (an ad), ?from=whatsapp, ... Ads Manager can also send
 *   from=ad-{{site_source_name}}, which becomes ad-fb / ad-ig.
 *
 * Results: "fb", "ig", "fb-ad", "ig-ad", or the link's own label. Nothing personal is kept: only this label,
 * in this browser, for 30 days (so a requirement posted a few days after the ad still counts for it).
 */
const KEY = "landfinder.source";
const SESSION_KEY = "landfinder.sourceNow";
const KEEP_MS = 30 * 24 * 3600 * 1000;

const clean = (v: string) => (/^[a-z0-9-]{1,30}$/.test(v) ? v : "");

function platform(): "fb" | "ig" | "" {
  const ua = navigator.userAgent;
  const ref = document.referrer;
  if (/Instagram/i.test(ua) || /instagram\.com/i.test(ref)) return "ig";
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/.test(ua) || /(facebook|fb)\.com/i.test(ref)) return "fb";
  return "";
}

function fromLink(label: string, app: "fb" | "ig" | ""): string {
  if (label === "ad") return app ? `${app}-ad` : "ad";
  const m = label.match(/^ad-(fb|ig)$/); // from Ads Manager: ad-{{site_source_name}}
  if (m) return `${m[1]}-ad`;
  if (label.startsWith("ad-")) return app ? `${app}-ad` : "ad"; // other placements (audience network, messenger)
  return label;
}

/** Run once when the app opens. */
export function detectSource() {
  try {
    const url = new URL(window.location.href);
    const label = clean((url.searchParams.get("from") ?? "").toLowerCase());
    const src = label ? fromLink(label, platform()) : platform();
    if (label) {
      url.searchParams.delete("from"); // keep shared links clean
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    if (!src) return;
    // A labelled link (an ad, ?from=whatsapp...) always wins. Plain "opened inside Facebook/Instagram" never
    // replaces a label already known for this visit or from the last 30 days (a reload keeps "Instagram ad").
    if (label || !sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, label ? src : cameFrom() || src);
    if (label || !cameFrom()) localStorage.setItem(KEY, JSON.stringify({ src, at: Date.now() }));
  } catch {
    /* storage blocked: just not counted by source */
  }
}

/** Where this visit came from (for counting visitors). */
export function visitSource(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

/** What brought this buyer here, this visit or in the last 30 days (for requirements and visit requests). */
export function cameFrom(): string {
  const now = visitSource();
  if (now) return now;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { src: string; at: number } | null;
    return saved && Date.now() - saved.at < KEEP_MS ? saved.src : "";
  } catch {
    return "";
  }
}

/** "ig-ad" -> "Instagram ad", for the admin screens. */
export function sourceLabel(src: string): string {
  const known: Record<string, string> = {
    "fb-ad": "Facebook ad",
    "ig-ad": "Instagram ad",
    fb: "Facebook",
    ig: "Instagram",
    ad: "Ad",
    other: "Other / direct",
  };
  return known[src] ?? src.charAt(0).toUpperCase() + src.slice(1).replace(/-/g, " ");
}
