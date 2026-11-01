import { cn } from "@/lib/utils";

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
        <span
          className={cn(
            "absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
