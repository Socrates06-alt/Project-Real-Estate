import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home, MessageCircle, Phone, Trees } from "lucide-react";
import { api, getConfig, type MySubmission, type SubmissionStatus } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { Segmented } from "@/components/ui/segmented";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/States";
import { telLink, waLink } from "@/components/contact";
import { cn } from "@/lib/utils";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const STATUS: Record<SubmissionStatus, { label: string; tone: "sky" | "brand" | "sold" | "gray"; step: number }> = {
  received: { label: "Submitted", tone: "sky", step: 0 },
  under_review: { label: "Under review", tone: "sky", step: 1 },
  listed: { label: "Live", tone: "brand", step: 2 },
  sold: { label: "Sold", tone: "sold", step: 3 },
  withdrawn: { label: "Not listed", tone: "gray", step: -1 },
  rejected: { label: "Not listed", tone: "gray", step: -1 },
};
const STEPS = ["Submitted", "Review", "Live", "Sold"];

export default function Profile() {
  const [tab, setTab] = useState<"mine" | "how">("mine");
  return (
    <div className="space-y-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <ThemeSwitch />
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "mine", label: "My listings" },
          { value: "how", label: "How it works" },
        ]}
      />
      {tab === "mine" ? <MyListings /> : <HowItWorks />}
    </div>
  );
}

function MyListings() {
  const { data, error, loading, reload } = useAsync(() => api<MySubmission[]>("/api/my/submissions", { device: true }), []);
  if (error) return <ErrorState message={error.message} retry={reload} />;
  if (loading && !data) return <div className="h-32 animate-pulse rounded-3xl border border-line bg-surface" />;
  if (!data?.length)
    return (
      <EmptyState
        icon={<Home size={28} />}
        title="No listings yet"
        text="Properties you list from this phone show up here with their status."
        action={
          <Link to="/sell" className={buttonVariants({ size: "sm" })}>
            List a property
          </Link>
        }
      />
    );

  return (
    <div className="space-y-3">
      {data.map((s) => {
        const st = STATUS[s.status];
        const Icon = s.property_type === "house" ? Home : Trees;
        const body = (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{s.location}</p>
                <p className="text-sm text-sub">
                  {inr(s.expected_price)} · {shortDate(s.created_at)}
                </p>
              </div>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            {st.step >= 0 && (
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {STEPS.map((label, i) => (
                  <div key={label}>
                    <div className={cn("h-1.5 rounded-full", i <= st.step ? "bg-brand" : "bg-muted")} />
                    <p className={cn("mt-1.5 text-[11px]", i <= st.step ? "font-semibold text-ink" : "text-sub")}>{label}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 flex items-center justify-between text-xs text-sub">
              Property <span className="font-semibold text-ink">#{s.number}</span>
              {s.listing_id && (
                <span className="ml-auto flex items-center font-semibold text-brand">
                  View listing <ChevronRight size={14} />
                </span>
              )}
            </p>
          </>
        );
        const cls = "block rounded-3xl border border-line bg-surface p-4 shadow-card";
        return s.listing_id ? (
          <Link key={s.id} to={`/p/${s.listing_id}`} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={s.id} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function HowItWorks() {
  const { data: config } = useAsync(getConfig, []);
  const steps = [
    ["List for free", "Add photos and details. We call to confirm."],
    ["We verify & post", "Your listing goes live with our number, never yours."],
    ["Buyers contact us", "We arrange and join every visit."],
    ["Pay only on sale", "Brokerage is due only when the deal closes."],
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <ol className="space-y-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{i + 1}</span>
              <div>
                <p className="font-bold">{t}</p>
                <p className="text-sm text-sub">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Fee label="Seller" value={`${config?.brokerage.seller_pct ?? 2}%`} />
        <Fee label="Buyer" value={`${config?.brokerage.buyer_pct ?? 1}%`} />
      </div>
      <p className="px-2 text-center text-xs text-sub">GST applies additionally. Listing is always free.</p>
      {config && (
        <div className="grid grid-cols-2 gap-3">
          <a href={waLink(config.contact)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "wa" })}>
            <MessageCircle size={18} /> WhatsApp
          </a>
          <a href={telLink(config.contact)} className={buttonVariants({ variant: "outline" })}>
            <Phone size={18} /> Call
          </a>
        </div>
      )}
    </div>
  );
}

function Fee({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 text-center shadow-card">
      <p className="text-3xl font-semibold text-brand">{value}</p>
      <p className="text-sm text-sub">{label} brokerage + GST</p>
    </div>
  );
}
