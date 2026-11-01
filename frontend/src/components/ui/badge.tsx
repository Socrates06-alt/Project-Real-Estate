import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  brand: "bg-brand-soft text-brand",
  sold: "bg-sold/12 text-sold",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  gray: "bg-muted text-sub",
  glass: "bg-black/45 text-white backdrop-blur-md",
};

export function Badge({ tone = "gray", className, children }: { tone?: keyof typeof tones; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
