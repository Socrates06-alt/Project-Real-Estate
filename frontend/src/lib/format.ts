/** ₹62 L, ₹1.25 Cr */
export function inr(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7, 2)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5, 1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function trim(v: number, digits: number) {
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

export function cents(v: number | string) {
  return `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })} cents`;
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

export const typeLabel = (t: string) => (t === "house" ? "House" : "Land");

/** Kerala buyers compare land by price per cent: "₹1.8 L/cent". */
export function perCent(price: number, cents: number): string | null {
  if (!cents) return null;
  return `${inr(price / cents)}/cent`;
}

/** Listed within the last 7 days. */
export const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 86400 * 1000;
