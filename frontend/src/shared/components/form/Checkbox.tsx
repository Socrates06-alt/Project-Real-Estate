import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** The square tick box used on the Sell form. */
export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition", checked ? "border-brand bg-brand text-brand-ink" : className)}
    >
      {checked && <Check size={15} strokeWidth={3} />}
    </button>
  );
}
