import type { ReactNode } from "react";

/** A titled section of the Sell form. */
export function FormCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5 card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {hint && <span className="text-xs text-sub">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
