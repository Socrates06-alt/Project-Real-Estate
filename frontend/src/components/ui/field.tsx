import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-2xl border border-line bg-muted/60 px-4 py-3 text-[15px] text-ink placeholder:text-sub/70 outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-28 resize-y", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
        {label}
        {hint && <span className="text-xs font-normal text-sub">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
