import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  brand: "bg-brand-soft text-brand",
  house: "bg-house-soft text-house",
  land: "bg-land-soft text-land",
  commercial: "bg-commercial-soft text-commercial",
  sky: "bg-sky text-sky-ink",
  sold: "bg-sold-soft text-sold",
  gray: "bg-muted text-sub",
  accent: "bg-accent text-accent-ink",
  verified: "bg-verified-soft text-verified",
  glass: "bg-black/45 text-white backdrop-blur-md",
};

export function Badge({ tone = "gray", className, children }: { tone?: keyof typeof tones; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
