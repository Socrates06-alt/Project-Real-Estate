import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-2xl bg-muted p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-[15px] font-medium transition",
            value === o.value ? "bg-surface text-brand shadow-sm" : "text-sub",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
