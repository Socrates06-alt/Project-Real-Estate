import type { ReactNode } from "react";

/** Indigo band with the page title, used at the top of every main screen. */
export function PageHeader({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="brand-header -mx-4 mb-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/75">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}
