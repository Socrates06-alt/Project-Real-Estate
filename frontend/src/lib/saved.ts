import { useEffect, useState } from "react";

/** Saved properties (shortlist), kept on this phone only - no login needed. */
const KEY = "nilayam.saved";
const EVENT = "nilayam:saved";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function toggleSaved(id: string): boolean {
  const ids = read();
  const on = !ids.includes(id);
  write(on ? [id, ...ids] : ids.filter((x) => x !== id));
  return on;
}

export function removeSaved(id: string) {
  write(read().filter((x) => x !== id));
}

/** Live list of saved ids (updates everywhere when one changes). */
export function useSavedIds(): string[] {
  const [ids, setIds] = useState(read);
  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}
