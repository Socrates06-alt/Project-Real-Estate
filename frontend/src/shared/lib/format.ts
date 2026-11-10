/** ₹62 L, ₹1.25 Cr */
export function inr(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7, 2)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5, 1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function trim(v: number, digits: number) {
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

/** Land size: "10 cents" below an acre, "1.5 acres" from 100 cents (1 acre = 100 cents). */
export function cents(v: number | string) {
  const n = Number(v);
  if (n >= 100) {
    const acres = Number((n / 100).toFixed(2));
    return `${acres.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${acres === 1 ? "acre" : "acres"}`;
  }
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} cents`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d`;
  return shortDate(iso);
}

export const typeLabel = (t: string) => ({ house: "House", land: "Land", commercial: "Commercial" })[t] ?? t;

/**
 * How a listing's price is shown. Land is quoted per cent in Kerala, so for land the per-cent price is the main
 * figure and the total is secondary; houses and commercial show the total.
 */
export function priceDisplay(price: number, type: string, landCents: number): { main: string; unit: string; side: string | null } {
  if (type === "land" && landCents > 0) return { main: inr(price / landCents), unit: "/cent", side: `${inr(price)} total` };
  return { main: inr(price), unit: "", side: null };
}

/** Listed within the last 7 days. */
export const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 86400 * 1000;


/** "Land for sale" → "Land" (the automatic titles); a title the admin wrote stays as it is. */
export const shortTitle = (title: string) => title.replace(/\s+for\s+sale\.?$/i, "");
