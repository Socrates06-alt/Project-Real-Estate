/**
 * English / Malayalam for the public app. Text lives in en.ts and ml.ts under short names; components call
 * t("nav.buy"). A missing Malayalam line falls back to English, so nothing ever shows blank.
 * The choice is saved on the phone; the first visit follows the phone's language.
 */
import { useSyncExternalStore } from "react";
import { en, type Key } from "./en";
import { ml } from "./ml";

export type Lang = "en" | "ml";
export type { Key };
const KEY = "landfinder.lang";
const ASKED_KEY = "landfinder.langAsked";

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ml") return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith("ml") ? "ml" : "en";
}

let lang: Lang = initial();
const listeners = new Set<() => void>();

function apply() {
  document.documentElement.lang = lang;
  if (lang === "ml" && !document.getElementById("font-ml")) {
    const link = document.createElement("link");
    link.id = "font-ml";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }
}
apply();

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* storage blocked */
  }
  apply();
  listeners.forEach((l) => l());
}

export const getLang = () => lang;

/** Re-renders when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

/** Text in the current language: t("sell.title"), or with values: t("similar.moreIn", { place: "Puliyoor" }). */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = (lang === "ml" && ml[key]) || en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** First visit only: has the language strip been answered or dismissed? */
export function languageAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissLanguageStrip() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}
