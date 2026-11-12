import { cn } from "@/shared/lib/utils";
import { Link } from "react-router-dom";
import { ChevronRight, FileCheck2, Hammer, PartyPopper, Plus, UserPlus } from "lucide-react";
import { inr, shortDate, timeAgo, typeLabel } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { ErrorState } from "@/shared/components/States";
import { Logo } from "@/shared/components/Logo";
import { ThemeSwitch } from "@/shared/components/ThemeSwitch";
import { useAdmin } from "@/features/admin/auth";
import { PrivatePhoto, VisitCard } from "@/features/admin/ui";
import { Callbacks } from "./Callbacks";
import { VisitorStats } from "@/features/admin/VisitorStats";
import type { Group, Inbox as InboxData } from "@/features/admin/types";

const NEW_SHOWN = 5; // the rest are under Properties > New

export default function Inbox() {
  const { call } = useAdmin();
  const { data, error, reload } = useAsync(() => call<InboxData>("/inbox"), []);

  if (error) return <ErrorState message={error.message} retry={reload} />;
  const empty = data && !data.new.length && !data.visits.length;

  const tiles: [Group, string, string][] = [
    ["new", "New", "bg-sky text-sky-ink"],
    ["live", "Live", "bg-brand-soft text-brand"],
    ["sold", "Sold", "bg-sold-soft text-sold"],
    ["not_listed", "Not listed", "bg-muted text-sub"],
  ];
  const shown = data?.new.slice(0, NEW_SHOWN) ?? [];

  return (
    <div className="space-y-5">
      <header className="brand-header -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <Logo light />
        <ThemeSwitch />
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/admin/new" className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand text-sm font-semibold text-brand-ink shadow-sm">
          <Plus size={17} strokeWidth={2.5} /> Add property
        </Link>
        <Link to="/admin/buyers?add=1" className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand-soft text-sm font-semibold text-brand">
          <Plus size={17} strokeWidth={2.5} /> Add buyer
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {tiles.map(([g, label, tone]) => (
          <Link key={g} to={`/admin/properties?group=${g}`} className={cn("rounded-[18px] py-2.5 text-center transition active:scale-[0.97]", tone)}>
            <p className="text-xl font-semibold">{data?.counts[g] ?? "–"}</p>
            <p className="text-[11px] opacity-80">{label}</p>
          </Link>
        ))}
      </div>

      {!!data?.buyer_requests && (
        <Link to="/admin/buyers" className="flex items-center gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold">
          <UserPlus size={18} /> <span className="flex-1">{data.buyer_requests} new requirement{data.buyer_requests > 1 ? "s" : ""}</span>
          <ChevronRight size={16} />
        </Link>
      )}

      <Callbacks onChange={reload} />

      {!!data?.ads_to_confirm.length && (
        <section className="space-y-2">
          <h2 className="px-1 font-semibold">Payments to confirm · {data.ads_to_confirm.length}</h2>
          {data.ads_to_confirm.map((p) => (
            <Link key={p.id} to={`/admin/p/${p.id}`} className="card flex items-center justify-between gap-3 p-3.5">
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  #{p.number} · {p.seller_name}
                </span>
                <span className="block text-sm text-sub">
                  {p.plan === "ad_social" ? "Ad + FB/IG" : "Ad: website"} · says paid {timeAgo(p.payment_claimed_at!)} ago
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">Check & mark paid</span>
            </Link>
          ))}
        </section>
      )}

      {!!data?.ads_ending.length && (
        <section className="space-y-2">
          <h2 className="px-1 font-semibold">Ads ending this week · {data.ads_ending.length}</h2>
          {data.ads_ending.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-3 p-3.5">
              <Link to={`/admin/p/${p.id}`} className="min-w-0">
                <span className="block truncate font-semibold">
                  #{p.number} · {p.seller_name}
                </span>
                <span className="block text-sm text-sub">Ends {shortDate(p.ad_expires_at!)}</span>
              </Link>
              <a
                href={`https://wa.me/${p.seller_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hi ${p.seller_name}, your LandFinder ad for property #${p.number} ends on ${shortDate(p.ad_expires_at!)}. Reply here to renew it for another month.`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full bg-wa px-3 py-1.5 text-xs font-semibold text-white"
              >
                Remind on WhatsApp
              </a>
            </div>
          ))}
        </section>
      )}

      <VisitorStats />


      {!data && <div className="h-40 shimmer rounded-[28px]" />}
      {empty && (
        <div className="card px-6 py-10 text-center">
          <PartyPopper className="mx-auto mb-2 text-brand" size={28} />
          <p className="font-semibold">All caught up</p>
        </div>
      )}

      {!!data?.new.length && (
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="font-semibold">New properties · {data.new.length}</h2>
            {data.new.length > NEW_SHOWN && (
              <Link to="/admin/properties?group=new" className="text-sm font-semibold text-brand">
                See all
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {shown.map((p) => (
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

    </div>
  );
}
