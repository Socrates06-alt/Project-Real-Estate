import { deviceToken } from "@/shared/lib/device";
import type { PublicConfig } from "./types";

// Types live in types.ts; re-exported so callers can import everything from the client.
export type * from "./types";

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

/** POST a form with upload progress (0–100). fetch() can't report upload progress, so this uses XHR. */
export function uploadForm<T>(path: string, form: FormData, onProgress: (pct: number) => void, opts: { device?: boolean } = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", BASE + path);
    if (opts.device) xhr.setRequestHeader("X-Device-Token", deviceToken());
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded * 100) / e.total));
    xhr.onerror = () => reject(new ApiError(0, "You seem to be offline. Please try again."));
    xhr.ontimeout = () => reject(new ApiError(0, "The upload took too long. Please try again on a better connection."));
    xhr.onload = async () => {
      const res = new Response(xhr.responseText, {
        status: xhr.status,
        headers: { "content-type": xhr.getResponseHeader("content-type") ?? "" },
      });
      if (!res.ok) return reject(new ApiError(res.status, await errorMessage(res)));
      try {
        resolve(JSON.parse(xhr.responseText) as T);
      } catch {
        reject(new ApiError(res.status, "Something went wrong. Please try again."));
      }
    };
    xhr.timeout = 5 * 60 * 1000;
    xhr.send(form);
  });
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

// ---- Shared calls ------------------------------------------------------------

let configCache: Promise<PublicConfig> | null = null;
export function getConfig() {
  configCache ??= api<PublicConfig>("/api/config").catch((e) => {
    configCache = null;
    throw e;
  });
  return configCache;
}
