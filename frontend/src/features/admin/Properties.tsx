import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Plus, Search, Sparkles, X } from "lucide-react";
import { inr, shortTitle } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { ErrorState } from "@/shared/components/States";
import { useAdmin } from "@/features/admin/auth";
import { GROUP_LABEL, GroupBadge, PrivatePhoto } from "@/features/admin/ui";
import type { Group, PropertyRow } from "@/features/admin/types";
import { cn } from "@/shared/lib/utils";

const GROUPS: Group[] = ["new", "live", "sold", "not_listed"];

export default function Properties() {
  const { call } = useAdmin();
  const [params, setParams] = useSearchParams();
  const group = (GROUPS.includes(params.get("group") as Group) ? params.get("group") : "live") as Group;
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const { data, error, reload } = useAsync(
    () => call<PropertyRow[]>(q ? `/properties?q=${encodeURIComponent(q)}` : `/properties?group=${group}`),
    [group, q],
  );

  return (
    <div className="space-y-4">
      <header className="brand-header -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <Link to="/admin/new" className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-[var(--brand-deep)] shadow-sm">
          <Plus size={18} strokeWidth={2.5} /> Add
        </Link>
      </header>
      <div className="glass flex h-[52px] items-center gap-3 rounded-full px-5 shadow-card">
        <Search size={20} className="shrink-0 text-sub" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="No., phone, name or description"
          aria-label="Search properties"
          inputMode="search"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sub"
        />
        {input && (
          <button aria-label="Clear search" onClick={() => setInput("")} className="grid h-8 w-8 place-items-center rounded-full text-sub">
            <X size={16} />
          </button>
        )}
      </div>
      {!q && (
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setParams({ group: g }, { replace: true })}
            className={cn(
              "h-10 rounded-xl text-[13px] font-medium",
              g === group ? "bg-surface text-brand shadow-sm" : "text-sub",
            )}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>
      )}

      {error && <ErrorState message={error.message} retry={reload} />}
      {!data && !error && <div className="h-40 shimmer rounded-[28px]" />}
      {data && !data.length && (
        <p className="py-12 text-center text-sub">{q ? `No property matches "${q}"` : "Nothing here yet"}</p>
      )}

      <div className="space-y-2">
        {data?.map((p) => (
          <Link key={p.id} to={`/admin/p/${p.id}`} className="flex items-center gap-3 card p-3">
            <PrivatePhoto url={p.cover_url} type={p.property_type} className="h-16 w-16 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-semibold">{shortTitle(p.title) || p.location}</span>
                {q && <GroupBadge group={p.group} />}
              </p>
              <p className="text-sm">
                <span className="font-medium">{inr(p.price)}</span>
                <span className="text-sub">
                   · #{p.number} · {p.seller_name}
                </span>
              </p>
              {p.open_visits > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-brand">
                  <CalendarDays size={14} /> {p.open_visits} visit request{p.open_visits > 1 ? "s" : ""}
                </p>
              )}
              {p.via && <p className="mt-0.5 truncate text-sm font-medium text-brand">{p.via}</p>}
              {!!p.matching_buyers && (
                <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-brand">
                  <Sparkles size={14} /> {p.matching_buyers} matching buyer{p.matching_buyers > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <ChevronRight size={20} className="shrink-0 text-sub" />
          </Link>
        ))}
      </div>
    </div>
  );
}
