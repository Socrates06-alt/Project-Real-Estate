import { cn } from "@/shared/lib/utils";
import { Link } from "react-router-dom";
import { ChevronRight, FileCheck2, Hammer, Languages, PartyPopper, Plus } from "lucide-react";
import { inr, typeLabel } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { ErrorState } from "@/shared/components/States";
import { Logo } from "@/shared/components/Logo";
import { ThemeSwitch } from "@/shared/components/ThemeSwitch";
import { useAdmin } from "@/features/admin/auth";
import { PrivatePhoto, VisitCard } from "@/features/admin/ui";
import { VisitorStats } from "@/features/admin/VisitorStats";
import type { Group, Inbox as InboxData } from "@/features/admin/types";

export default function Inbox() {
  const { call } = useAdmin();
  const { data, error, reload } = useAsync(() => call<InboxData>("/inbox"), []);

  if (error) return <ErrorState message={error.message} retry={reload} />;
  const empty = data && !data.new.length && !data.visits.length;

  return (
    <div className="space-y-6">
      <header className="brand-header -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <Logo light />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">Admin</span>
          <ThemeSwitch />
        </div>
      </header>

      <Link to="/admin/new" className="btn-accent flex h-[52px] items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
        <Plus size={20} strokeWidth={2.5} /> Add property
      </Link>

      {/* TEMPORARY one-time tool: remove this link when the clean-up is done */}
      <Link to="/admin/cleanup" className="flex items-center gap-3 card p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Languages size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Clean up listings to English</span>
          <span className="block text-xs text-sub">One-time: spelling, Malayalam → English, better sentences</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-sub" />
      </Link>

      <div className="grid grid-cols-3 gap-2">
        {(["live", "sold", "not_listed"] as Group[]).map((g) => (
          <Link
            key={g}
            to={`/admin/properties?group=${g}`}
            className={cn(
              "rounded-[20px] p-3 text-center transition active:scale-[0.97]",
              g === "live" ? "bg-brand-soft text-brand" : g === "sold" ? "bg-sold-soft text-sold" : "bg-muted text-sub",
            )}
          >
            <p className="text-2xl font-semibold">{data?.counts[g] ?? "–"}</p>
            <p className="text-xs opacity-80">{g === "live" ? "Live" : g === "sold" ? "Sold" : "Not listed"}</p>
          </Link>
        ))}
      </div>

      {!data && <div className="h-40 shimmer rounded-[28px]" />}
      {empty && (
        <div className="card px-6 py-10 text-center">
          <PartyPopper className="mx-auto mb-2 text-brand" size={28} />
          <p className="font-semibold">All caught up</p>
          <p className="text-sm text-sub">New properties and visit requests will appear here.</p>
        </div>
      )}

      {!!data?.new.length && (
        <section>
          <h2 className="mb-2 px-1 font-semibold">New properties · {data.new.length}</h2>
          <div className="space-y-2">
            {data.new.map((p) => (
              <Link key={p.id} to={`/admin/p/${p.id}`} className="flex items-center gap-3 card p-3">
                <PrivatePhoto url={p.cover_url} type={p.property_type} className="h-16 w-16 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.seller_name}</p>
                  <p className="truncate text-sm text-sub">
                    #{p.number} · {typeLabel(p.property_type)} · {p.location}
                  </p>
                  {(p.wants_doc_help || p.wants_dev_help) && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {p.wants_doc_help && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold">
                          <FileCheck2 size={12} /> Documentation help
                        </span>
                      )}
                      {p.wants_dev_help && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold">
                          <Hammer size={12} /> Development help
                        </span>
                      )}
                    </span>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">{inr(p.price)}</span>
                  </p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-sub" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {!!data?.visits.length && (
        <section>
          <h2 className="mb-2 px-1 font-semibold">Visit requests · {data.visits.length}</h2>
          <div className="space-y-2">
            {data.visits.map((v) => (
              <VisitCard key={v.id} visit={v} onChange={reload} showListing />
            ))}
          </div>
        </section>
      )}

      <VisitorStats />
    </div>
  );
}
