import { cn } from "@/shared/lib/utils";

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
    <div className={cn("flex rounded-[18px] bg-muted p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-[14px] px-4 py-2.5 text-[15px] font-medium transition duration-200",
            value === o.value ? "bg-surface text-brand shadow-[0_0_0_1px_var(--hairline),0_2px_6px_-2px_rgb(0_0_0/0.12)]" : "text-sub",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
