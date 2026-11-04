import { Home, LayoutGrid, Store, Trees } from "lucide-react";
import type { PropertyType } from "@/shared/api/client";

export type PropertyFilter = "all" | PropertyType;
import { cn } from "@/shared/lib/utils";

type Tile = { key: string; label: string; icon: React.ReactNode; tone: string; on: boolean; onClick: () => void };

/** Filter tiles: All, Houses, Land, Commercial. Tap to choose; tap again (or All) to clear. */
export function FilterTiles(props: { type: PropertyFilter; onType: (t: PropertyFilter) => void }) {
  const { type, onType } = props;
  const pick = (t: PropertyFilter) => () => onType(type === t ? "all" : t);
  const tiles: Tile[] = [
    { key: "all", label: "All", icon: <LayoutGrid size={18} />, tone: "bg-brand-soft text-brand", on: type === "all", onClick: () => onType("all") },
    { key: "house", label: "Houses", icon: <Home size={18} />, tone: "bg-house-soft text-house", on: type === "house", onClick: pick("house") },
    { key: "land", label: "Land", icon: <Trees size={18} />, tone: "bg-land-soft text-land", on: type === "land", onClick: pick("land") },
    { key: "commercial", label: "Commercial", icon: <Store size={18} />, tone: "bg-commercial-soft text-commercial", on: type === "commercial", onClick: pick("commercial") },
  ];
  return (
    <section className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          aria-pressed={t.on}
          className={cn(
            "card-sm flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-2 text-center transition duration-200 active:scale-95",
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
