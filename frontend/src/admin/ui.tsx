import type { ReactNode } from "react";
import type { SubmissionStatus } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ListingState } from "./types";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-3xl border border-line bg-surface p-5 shadow-card", className)}>{children}</section>;
}

export function FilterChips<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn("h-10 shrink-0 rounded-full border px-4 text-[15px] font-medium", value === v ? "border-brand/40 bg-brand-soft text-brand" : "border-line bg-surface text-sub")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const SUB: Record<SubmissionStatus, [string, "amber" | "brand" | "sold" | "gray"]> = {
  received: ["New", "amber"],
  under_review: ["Draft", "amber"],
  listed: ["Live", "brand"],
  sold: ["Sold", "sold"],
  withdrawn: ["Withdrawn", "gray"],
  rejected: ["Rejected", "gray"],
};
export const SubmissionBadge = ({ status }: { status: SubmissionStatus }) => <Badge tone={SUB[status][1]}>{SUB[status][0]}</Badge>;

const LST: Record<ListingState, [string, "amber" | "brand" | "sold" | "gray"]> = {
  draft: ["Draft", "amber"],
  published: ["Live", "brand"],
  sold: ["Sold", "sold"],
  withdrawn: ["Withdrawn", "gray"],
};
export const ListingBadge = ({ state }: { state: ListingState }) => <Badge tone={LST[state][1]}>{LST[state][0]}</Badge>;
