import { Emblem } from "./Emblem";

/** LandFinder logo. "light" = for indigo backgrounds (white tile, indigo emblem, white name). */
export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-[10px] ${light ? "bg-white" : "bg-brand-soft"}`}>
        <Emblem className="h-8 w-8" color="var(--brand-deep)" />
      </span>
      <span className={`text-[21px] font-semibold tracking-tight ${light ? "text-white" : ""}`}>LandFinder</span>
    </span>
  );
}
