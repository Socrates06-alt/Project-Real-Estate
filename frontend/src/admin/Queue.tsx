import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, Trees } from "lucide-react";
import type { SubmissionStatus } from "@/lib/api";
import { cents, inr, timeAgo } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { ErrorState } from "@/components/States";
import { useAdmin } from "./auth";
import { FilterChips, SubmissionBadge } from "./ui";
import type { AdminSubmissionRow } from "./types";

type Filter = "all" | SubmissionStatus;

export default function Queue() {
  const { call } = useAdmin();
  const [filter, setFilter] = useState<Filter>("received");
  const { data, error, reload } = useAsync(
    () => call<AdminSubmissionRow[]>(`/submissions${filter === "all" ? "" : `?status=${filter}`}`),
    [filter],
  );

  return (
    <>
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          ["received", "New"],
          ["under_review", "Drafts"],
          ["listed", "Live"],
          ["sold", "Sold"],
          ["rejected", "Rejected"],
          ["all", "All"],
        ]}
      />
      {error && <ErrorState message={error.message} retry={reload} />}
      {data && !data.length && <p className="py-10 text-center text-sub">Nothing here 🎉</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((s) => {
          const Icon = s.property_type === "house" ? Home : Trees;
          return (
            <Link key={s.id} to={`/admin/s/${s.id}`} className="rounded-[24px] bg-surface p-4 shadow-card transition hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.seller_name}</p>
                  <p className="text-sm text-sub">{s.seller_phone}</p>
                </div>
                <SubmissionBadge status={s.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-bold">{inr(s.expected_price)}</span>
                <span className="truncate pl-2 text-sub">
                  {cents(s.land_area_cents)} · {s.location}
                </span>
              </div>
              <p className="mt-1 text-xs text-sub">
                {s.ref_code} · {timeAgo(s.created_at)} ago
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
