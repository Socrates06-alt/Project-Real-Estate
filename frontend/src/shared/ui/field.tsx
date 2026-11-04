import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

const base =
  "w-full rounded-[18px] border border-transparent bg-muted px-4 py-3 text-[15px] text-ink placeholder:text-sub/70 outline-none transition duration-200 focus:border-brand/40 focus:bg-surface focus:ring-4 focus:ring-brand/12";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-28 resize-y", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between px-1 text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-sub">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Input with a fixed prefix/suffix shown inside the box (e.g. ₹ or "cents"). */
export function AffixInput({
  prefix,
  suffix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sub">{prefix}</span>}
      <input className={cn(base, "h-12", prefix && "pl-9", suffix && "pr-16", className)} {...props} />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-sub">{suffix}</span>
      )}
    </div>
  );
}
