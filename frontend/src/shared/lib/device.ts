const KEY = "nilayam.device";
let memory: string | null = null;

/** Anonymous per-device token used for "My listings" (no login in V1). */
export function deviceToken(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
  } catch {
    /* storage blocked */
  }
  if (!memory) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    memory = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    /* ignore */
  }
  return memory;
}
