import { deviceToken } from "./device";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; token?: string | null; device?: boolean };

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.device) headers["X-Device-Token"] = deviceToken();

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "You seem to be offline. Please try again.");
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return (res.headers.get("content-type")?.includes("json") ? res.json() : res.blob()) as Promise<T>;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      const d = data.detail[0];
      const field = String(d.loc?.at(-1) ?? "").replace(/_/g, " ");
      return field ? `${field}: ${String(d.msg).replace(/^Value error, /, "")}` : d.msg;
    }
  } catch {
    /* not json */
  }
  return res.status === 429 ? "Too many attempts. Please wait a while." : "Something went wrong. Please try again.";
}

export const mediaUrl = (u: string) => (u.startsWith("http") ? u : BASE + u);

// ---- Types -----------------------------------------------------------------

export type PropertyType = "house" | "land";

export interface Listing {
  id: string;
  number: number;
  status: "live" | "sold";
  version: number;
  title: string;
  property_type: PropertyType;
  land_area_cents: number;
  location: string;
  description: string;
  price: number;
  negotiable: boolean;
  documents_available: boolean;
  documents_note: string;
  photos: string[];
  published_at: string;
  listed_at: string;
  price_reduced: boolean;
  sold_at: string | null;
}

export interface Contact {
  phone: string;
  whatsapp: string;
}

export interface Parsed {
  text: string;
  property_type: PropertyType | null;
  min_price: number | null;
  max_price: number | null;
  min_cents: number | null;
  max_cents: number | null;
}

export interface Feed {
  items: Listing[];
  has_more: boolean;
  total: number;
  parsed: Parsed;
  contact: Contact;
}

export interface PublicConfig {
  contact: Contact;
  brokerage: { seller_pct: number; buyer_pct: number; gst_extra: boolean; listing_fee: number };
  consent_version: string;
  max_photos: number;
  max_photo_bytes: number;
}

export interface MySubmission {
  id: string;
  number: number;
  property_type: PropertyType;
  location: string;
  expected_price: number;
  status: SubmissionStatus;
  created_at: string;
  listing_id: string | null;
}

export type SubmissionStatus = "received" | "under_review" | "listed" | "sold" | "withdrawn" | "rejected";

// ---- Shared calls ------------------------------------------------------------

let configCache: Promise<PublicConfig> | null = null;
export function getConfig() {
  configCache ??= api<PublicConfig>("/api/config").catch((e) => {
    configCache = null;
    throw e;
  });
  return configCache;
}
