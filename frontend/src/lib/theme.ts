import { useState } from "react";

const KEY = "nilayam.theme";

/** Light is the default; dark only if the user turned it on (remembered on this phone). */
export function isDark(): boolean {
  try {
    return localStorage.getItem(KEY) === "dark";
  } catch {
    return false;
  }
}

function apply(dark: boolean) {
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  try {
    if (dark) localStorage.setItem(KEY, "dark");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: applies for this visit only */
  }
}

export function useDarkMode() {
  const [dark, setDark] = useState(isDark);
  const toggle = () => {
    apply(!dark);
    setDark(!dark);
  };
  return [dark, toggle] as const;
}
