import { useTheme, type ThemeChoice } from "@/lib/theme";
import { Segmented } from "./ui/segmented";

/** Appearance: Auto (follow phone) / Light / Dark — remembered on this phone. */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <p className="mb-2.5 font-semibold">Appearance</p>
      <Segmented<ThemeChoice>
        value={theme}
        onChange={setTheme}
        options={[
          { value: "auto", label: "Auto" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </section>
  );
}
