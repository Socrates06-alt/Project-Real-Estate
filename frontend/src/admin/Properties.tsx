import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Search, X } from "lucide-react";
import { inr } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { ErrorState } from "@/components/States";
import { useAdmin } from "./auth";
import { GROUP_LABEL, GroupBadge, PrivatePhoto } from "./ui";
import type { Group, PropertyRow } from "./types";
import { cn } from "@/lib/utils";

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
      <h1 className="px-1 text-2xl font-semibold">Properties</h1>
      <div className="glass flex h-[52px] items-center gap-3 rounded-full px-5 shadow-card">
        <Search size={20} className="shrink-0 text-sub" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Property no., phone or name"
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
      {!data && !error && <div className="h-40 animate-pulse rounded-3xl bg-surface" />}
      {data && !data.length && (
        <p className="py-12 text-center text-sub">{q ? `No property matches "${q}"` : "Nothing here yet"}</p>
      )}

      <div className="space-y-2">
        {data?.map((p) => (
          <Link key={p.id} to={`/admin/p/${p.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-3">
            <PrivatePhoto url={p.cover_url} type={p.property_type} className="h-16 w-16 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-semibold">{p.title || p.location}</span>
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
            </div>
            <ChevronRight size={20} className="shrink-0 text-sub" />
          </Link>
        ))}
      </div>
    </div>
  );
}
