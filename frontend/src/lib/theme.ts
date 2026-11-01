import { useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "nilayam.theme";

export function storedTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: still applies for this visit */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(storedTheme);
  return [theme, (t: ThemeChoice) => (applyTheme(t), setTheme(t))] as const;
}
