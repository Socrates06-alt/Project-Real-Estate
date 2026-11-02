import { Home, IndianRupee, LayoutGrid, Route, Trees } from "lucide-react";
import { cn } from "@/lib/utils";

type Tile = { key: string; label: string; icon: React.ReactNode; tone: string; on: boolean; onClick: () => void };

/** Square filter tiles (the Home page's filters). Tap to turn on, tap again to turn off. */
export function FilterTiles(props: {
  type: "all" | "house" | "land";
  text: string;
  onAll: () => void;
  onType: (t: "house" | "land") => void;
  onText: (t: string) => void;
}) {
  const { type, text } = props;
  const presets = ["under 30 lakh", "under 40 lakh", "under 50 lakh", "road"];
  const all = type === "all" && !presets.includes(text);
  const price = (lakh: number): Tile => ({
    key: `p${lakh}`,
    label: `Under ₹${lakh} L`,
    icon: <IndianRupee size={18} />,
    tone: "bg-accent-soft text-[var(--accent-strong)]",
    on: text === `under ${lakh} lakh`,
    onClick: () => props.onText(`under ${lakh} lakh`),
  });
  const tiles: Tile[] = [
    { key: "all", label: "All", icon: <LayoutGrid size={18} />, tone: "bg-brand-soft text-brand", on: all, onClick: props.onAll },
    { key: "house", label: "Houses", icon: <Home size={18} />, tone: "bg-house-soft text-house", on: type === "house", onClick: () => props.onType("house") },
    { key: "land", label: "Land", icon: <Trees size={18} />, tone: "bg-land-soft text-land", on: type === "land", onClick: () => props.onType("land") },
    { key: "road", label: "Road access", icon: <Route size={18} />, tone: "bg-sky text-sky-ink", on: text === "road", onClick: () => props.onText("road") },
    price(30),
    price(40),
    price(50),
  ];
  return (
    // Row 1: four tiles; row 2: the three price tiles, sharing the full width.
    <section className="grid grid-cols-12 gap-2">
      {tiles.map((t, i) => (
        <button
          key={t.key}
          onClick={t.onClick}
          aria-pressed={t.on}
          className={cn(
            "card-sm flex h-[76px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-center transition duration-200 active:scale-95",
            i < 4 ? "col-span-3" : "col-span-4",
            t.on && "shadow-[0_0_0_2px_var(--brand),var(--card-shadow)]",
          )}
        >
          <span className={cn("grid h-8 w-8 place-items-center rounded-[11px]", t.tone)}>{t.icon}</span>
          <span className={cn("text-[12px] leading-tight font-medium", t.on ? "text-brand" : "text-ink")}>{t.label}</span>
        </button>
      ))}
    </section>
  );
}
