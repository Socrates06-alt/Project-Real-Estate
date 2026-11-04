import { Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/shared/lib/theme";

/** Small icon button: tap to switch between light (default) and dark. */
export function ThemeSwitch() {
  const [dark, toggle] = useDarkMode();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid h-11 w-11 place-items-center card-sm rounded-full text-sub transition-colors hover:text-brand"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
