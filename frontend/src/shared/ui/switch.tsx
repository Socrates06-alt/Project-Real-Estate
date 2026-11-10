import { cn } from "@/shared/lib/utils";

/** The on/off pill on its own (used by Switch and by rows that need their own label). */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="shrink-0">
      <span className={cn("relative block h-7 w-12 rounded-full transition", checked ? "bg-brand" : "bg-line")}>
        <span className={cn("absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </button>
  );
}

/** A row with a label and an on/off toggle; tapping anywhere on the row switches it. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3.5 text-left text-[15px] font-medium"
    >
      {label}
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-line")}>
        <span className={cn("absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </button>
  );
}
