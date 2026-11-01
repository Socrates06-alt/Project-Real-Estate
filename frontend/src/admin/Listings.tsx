import { useState } from "react";
import { Link } from "react-router-dom";
import { inr, timeAgo } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { ErrorState } from "@/components/States";
import { useAdmin } from "./auth";
import { FilterChips, ListingBadge } from "./ui";
import type { AdminListing, ListingState } from "./types";

export default function Listings() {
  const { call } = useAdmin();
  const [filter, setFilter] = useState<"all" | ListingState>("published");
  const { data, error, reload } = useAsync(
    () => call<AdminListing[]>(`/listings${filter === "all" ? "" : `?state=${filter}`}`),
    [filter],
  );

  return (
    <>
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          ["published", "Live"],
          ["draft", "Drafts"],
          ["sold", "Sold"],
          ["withdrawn", "Withdrawn"],
          ["all", "All"],
        ]}
      />
      {error && <ErrorState message={error.message} retry={reload} />}
      {data && !data.length && <p className="py-10 text-center text-sub">No listings</p>}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        {data?.map((l) => (
          <Link key={l.id} to={`/admin/s/${l.submission_id}`} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0 hover:bg-muted/50">
            <span className="w-14 shrink-0 font-mono text-sm text-sub">#{l.number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{l.title}</p>
              <p className="text-xs text-sub">
                {l.location} · v{l.current_version} · updated {timeAgo(l.updated_at)} ago
              </p>
            </div>
            <span className="hidden font-bold sm:block">{inr(l.price)}</span>
            <ListingBadge state={l.state} />
          </Link>
        ))}
      </div>
    </>
  );
}
