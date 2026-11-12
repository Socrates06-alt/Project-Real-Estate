import { Handshake, Megaphone } from "lucide-react";
import type { PublicConfig, SellPlan } from "@/shared/api/client";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

/** Two ways to sell: advertise (pay a small fee, talk to buyers yourself) or we sell it (commission on sale). */
export function PlanChooser({ plan, onPlan, config }: { plan: SellPlan; onPlan: (p: SellPlan) => void; config: PublicConfig }) {
  const ad = plan !== "commission";
  const card = (on: boolean) =>
    cn(
      "flex flex-col gap-1.5 rounded-[20px] bg-surface p-3.5 text-left transition",
      on ? "shadow-[0_0_0_2px_var(--brand),var(--card-shadow)]" : "shadow-[0_0_0_1px_var(--hairline)]",
    );
  const option = (value: SellPlan, label: string, price: number) => (
    <button
      type="button"
      onClick={() => onPlan(value)}
      aria-pressed={plan === value}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm",
        plan === value ? "bg-brand-soft font-semibold text-brand" : "bg-muted text-ink",
      )}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-semibold">₹{price}</span>
    </button>
  );
  return (
    <section>
      <h2 className="mb-2 px-1 font-semibold">{t("plan.title")}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={card(ad)} onClick={() => !ad && onPlan("ad_social")}>
          <Megaphone size={20} className="text-brand" />
          <p className="font-semibold">{t("plan.adTitle")}</p>
          <p className="text-xs text-sub">
            {t("plan.adFrom", { price: config.ads.web })} · {t("plan.adYou")}
          </p>
          <div className="mt-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {option("ad_web", t("plan.adWeb"), config.ads.web)}
            {option("ad_social", t("plan.adSocial"), config.ads.social)}
          </div>
        </div>
        <button type="button" onClick={() => onPlan("commission")} aria-pressed={!ad} className={card(!ad)}>
          <Handshake size={20} className="text-brand" />
          <p className="font-semibold">{t("plan.usTitle")}</p>
          <p className="text-xs text-sub">{t("plan.usPay")}</p>
          <p className="text-sm font-semibold">{t("plan.usFee", { pct: config.brokerage.seller_pct })}</p>
          <p className="text-xs text-sub">{t("plan.usWhat")}</p>
        </button>
      </div>
    </section>
  );
}
