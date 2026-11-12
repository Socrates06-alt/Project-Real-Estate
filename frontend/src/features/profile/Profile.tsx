import { t, type Key } from "@/shared/i18n";
import { TYPE_ICON } from "@/shared/lib/propertyType";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home, MessageCircle, Phone } from "lucide-react";
import { api, getConfig, type MySubmission, type SubmissionStatus } from "@/shared/api/client";
import { inr, shortDate } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { Segmented } from "@/shared/ui/segmented";
import { Badge } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { EmptyState, ErrorState } from "@/shared/components/States";
import { telLink, waLink } from "@/shared/components/contact";
import { cn } from "@/shared/lib/utils";
import { ThemeSwitch } from "@/shared/components/ThemeSwitch";
import { LanguageMenu } from "@/shared/components/LanguageMenu";
import { PageHeader } from "@/shared/components/PageHeader";

// Labels are text keys, turned into words at render time so they follow the chosen language.
const STATUS: Record<SubmissionStatus, { label: Key; tone: "sky" | "brand" | "sold" | "gray"; step: number }> = {
  received: { label: "profile.submitted", tone: "sky", step: 0 },
  under_review: { label: "profile.underReview", tone: "sky", step: 1 },
  listed: { label: "profile.live", tone: "brand", step: 2 },
  sold: { label: "common.sold", tone: "sold", step: 3 },
  withdrawn: { label: "profile.notListed", tone: "gray", step: -1 },
  rejected: { label: "profile.notListed", tone: "gray", step: -1 },
};
const STEPS: Key[] = ["profile.submitted", "profile.review", "profile.live", "common.sold"];

export default function Profile() {
  const [tab, setTab] = useState<"mine" | "how">("mine");
  return (
    <div className="space-y-4">
      <PageHeader title={t("profile.title")} right={
          <div className="flex items-center gap-2">
            <LanguageMenu />
            <ThemeSwitch />
          </div>
        } />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "mine", label: t("profile.mine") },
          { value: "how", label: t("profile.how") },
        ]}
      />
      {tab === "mine" ? <MyListings /> : <HowItWorks />}
    </div>
  );
}

function MyListings() {
  const { data, error, loading, reload } = useAsync(() => api<MySubmission[]>("/api/my/submissions", { device: true }), []);
  if (error) return <ErrorState message={error.message} retry={reload} />;
  if (loading && !data) return <div className="h-32 animate-pulse card" />;
  if (!data?.length)
    return (
      <EmptyState
        icon={<Home size={28} />}
        title={t("profile.noListings")}
        text={t("profile.noListingsText")}
        action={
          <Link to="/sell" className={buttonVariants({ size: "sm" })}>
            {t("profile.listProperty")}
          </Link>
        }
      />
    );

  return (
    <div className="space-y-3">
      {data.map((s) => {
        const st = STATUS[s.status];
        const Icon = TYPE_ICON[s.property_type];
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
              <Badge tone={st.tone}>{t(st.label)}</Badge>
            </div>
            {st.step >= 0 && (
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {STEPS.map((label, i) => (
                  <div key={label}>
                    <div className={cn("h-1.5 rounded-full", i <= st.step ? "bg-brand" : "bg-muted")} />
                    <p className={cn("mt-1.5 text-[11px]", i <= st.step ? "font-semibold text-ink" : "text-sub")}>{t(label)}</p>
                  </div>
                ))}
              </div>
            )}
            {s.listing_id && (
              <p className="mt-3 flex items-center justify-end text-xs font-semibold text-brand">
                {t("profile.viewListing")} <ChevronRight size={14} />
              </p>
            )}
          </>
        );
        const cls = "block card p-4 shadow-card";
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
    [t("profile.step1"), t("profile.step1Text")],
    [t("profile.step2"), t("profile.step2Text")],
    [t("profile.step3"), t("profile.step3Text")],
    [t("profile.step4"), t("profile.step4Text")],
  ];
  return (
    <div className="space-y-4">
      <div className="card p-5 shadow-card">
        <ol className="space-y-4">
          {steps.map(([title, d], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{i + 1}</span>
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-sub">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Fee label={t("profile.seller")} tone="bg-peach-soft text-peach" value={`${config?.brokerage.seller_pct ?? 2}%`} />
        <Fee label={t("profile.buyer")} tone="bg-sky text-sky-ink" value={`${config?.brokerage.buyer_pct ?? 1}%`} />
      </div>
      <p className="px-2 text-center text-xs text-sub">{t("profile.alwaysFree")}</p>
      <p className="px-2 text-center text-xs text-sub">
        <Link to="/terms" className="underline underline-offset-2">{t("common.terms")}</Link>
        {" · "}
        <Link to="/privacy" className="underline underline-offset-2">{t("common.privacy")}</Link>
      </p>
      {config && (
        <div className="grid grid-cols-2 gap-3">
          <a href={waLink(config.contact)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "wa" })}>
            <MessageCircle size={18} /> {t("common.whatsapp")}
          </a>
          <a href={telLink(config.contact)} className={buttonVariants({ variant: "outline" })}>
            <Phone size={18} /> {t("common.call")}
          </a>
        </div>
      )}
    </div>
  );
}

function Fee({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("rounded-[28px] p-4 text-center", tone)}>
      <p className="text-3xl font-semibold">{value}</p>
      <p className="text-sm text-sub">{t("profile.brokerage", { who: label })}</p>
    </div>
  );
}
