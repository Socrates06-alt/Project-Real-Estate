import { BadgeCheck, FileCheck2, Home, IndianRupee, LayoutGrid, MessageCircle, Route, Sprout, Trees } from "lucide-react";
import type { Contact } from "@/lib/api";
import { cn } from "@/lib/utils";
import { waLink } from "./contact";

type Tile = { key: string; label: string; icon: React.ReactNode; tone: string; on: boolean; onClick: () => void };

/** Square filter tiles (the Home page's filters). Tap to turn on, tap again to turn off. */
export function FilterTiles(props: {
  type: "all" | "house" | "land";
  status: "live" | "sold";
  docs: boolean;
  text: string;
  onAll: () => void;
  onType: (t: "house" | "land") => void;
  onSold: () => void;
  onDocs: () => void;
  onText: (t: string) => void;
}) {
  const { type, status, docs, text } = props;
  const presets = ["under 30 lakh", "road", "rubber"];
  const all = type === "all" && status === "live" && !docs && !presets.includes(text);
  const tiles: Tile[] = [
    { key: "all", label: "All", icon: <LayoutGrid size={21} />, tone: "bg-brand-soft text-brand", on: all, onClick: props.onAll },
    { key: "house", label: "Houses", icon: <Home size={21} />, tone: "bg-house-soft text-house", on: type === "house", onClick: () => props.onType("house") },
    { key: "land", label: "Land", icon: <Trees size={21} />, tone: "bg-land-soft text-land", on: type === "land", onClick: () => props.onType("land") },
    { key: "price", label: "Under ₹30 L", icon: <IndianRupee size={21} />, tone: "bg-accent-soft text-[var(--accent-strong)]", on: text === "under 30 lakh", onClick: () => props.onText("under 30 lakh") },
    { key: "road", label: "Road access", icon: <Route size={21} />, tone: "bg-sky text-sky-ink", on: text === "road", onClick: () => props.onText("road") },
    { key: "docs", label: "Documents ready", icon: <FileCheck2 size={21} />, tone: "bg-peach-soft text-peach", on: docs, onClick: props.onDocs },
    { key: "rubber", label: "Rubber / farm", icon: <Sprout size={21} />, tone: "bg-[color-mix(in_srgb,var(--wa)_14%,var(--surface))] text-wa", on: text === "rubber", onClick: () => props.onText("rubber") },
    { key: "sold", label: "Sold", icon: <BadgeCheck size={21} />, tone: "bg-sold-soft text-sold", on: status === "sold", onClick: props.onSold },
  ];
  return (
    <section className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          aria-pressed={t.on}
          className={cn(
            "card-sm flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[18px] px-1 text-center transition duration-200 active:scale-95",
            t.on && "shadow-[0_0_0_2px_var(--brand),var(--card-shadow)]",
          )}
        >
          <span className={cn("grid h-10 w-10 place-items-center rounded-[14px]", t.tone)}>{t.icon}</span>
          <span className={cn("text-[12px] leading-tight font-medium", t.on ? "text-brand" : "text-ink")}>{t.label}</span>
        </button>
      ))}
    </section>
  );
}

/** Familiar floating WhatsApp button (bottom right, above the nav). */
export function FloatingWhatsApp({ contact }: { contact: Contact }) {
  return (
    <a
      href={waLink(contact)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Nilayam on WhatsApp"
      className="fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+76px)] z-40 grid h-14 w-14 place-items-center rounded-full bg-wa text-white shadow-float transition active:scale-95"
    >
      <MessageCircle size={26} />
    </a>
  );
}
