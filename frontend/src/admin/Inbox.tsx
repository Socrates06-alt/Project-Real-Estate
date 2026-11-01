import { Link } from "react-router-dom";
import { ChevronRight, PartyPopper } from "lucide-react";
import { inr, timeAgo, typeLabel } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { ErrorState } from "@/components/States";
import { Logo } from "@/components/Logo";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { useAdmin } from "./auth";
import { PrivatePhoto, VisitCard } from "./ui";
import type { Group, Inbox as InboxData } from "./types";

export default function Inbox() {
  const { call } = useAdmin();
  const { data, error, reload } = useAsync(() => call<InboxData>("/inbox"), []);

  if (error) return <ErrorState message={error.message} retry={reload} />;
  const empty = data && !data.new.length && !data.visits.length;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">Admin</span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {(["live", "sold", "not_listed"] as Group[]).map((g) => (
          <Link key={g} to={`/admin/properties?group=${g}`} className="rounded-2xl border border-line bg-surface p-3 text-center">
            <p className="text-2xl font-semibold">{data?.counts[g] ?? "–"}</p>
            <p className="text-xs text-sub">{g === "live" ? "Live" : g === "sold" ? "Sold" : "Not listed"}</p>
          </Link>
        ))}
      </div>

      {!data && <div className="h-40 animate-pulse rounded-3xl bg-surface" />}
      {empty && (
        <div className="rounded-3xl border border-line bg-surface px-6 py-10 text-center">
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
              <Link key={p.id} to={`/admin/p/${p.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-3">
                <PrivatePhoto url={p.cover_url} type={p.property_type} className="h-16 w-16 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.seller_name}</p>
                  <p className="truncate text-sm text-sub">
                    {typeLabel(p.property_type)} · {p.location}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">{inr(p.price)}</span>
                    <span className="text-sub"> · {timeAgo(p.created_at)} ago</span>
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

      <ThemeSwitch />
    </div>
  );
}
