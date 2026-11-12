/**
 * Saved properties (❤️): kept on this phone only, no login. A shortlist people come back to and show family.
 */
import { useSyncExternalStore } from "react";

const KEY = "landfinder.saved";
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let ids = read();

function write(next: string[]) {
  ids = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: kept for this visit only */
  }
  listeners.forEach((l) => l());
}

/** Newest first. */
export function toggleSaved(id: string) {
  write(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 100));
}

export function removeSaved(id: string) {
  if (ids.includes(id)) write(ids.filter((x) => x !== id));
}

export function useSavedIds(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ids,
  );
}
