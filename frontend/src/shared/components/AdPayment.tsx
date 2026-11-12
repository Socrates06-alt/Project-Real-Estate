import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Smartphone } from "lucide-react";
import { api, getConfig, type SellPlan } from "@/shared/api/client";
import { useAsync } from "@/shared/lib/useAsync";
import { useSubmit } from "@/shared/lib/useSubmit";
import { Button, buttonVariants } from "@/shared/ui/button";
import { t } from "@/shared/i18n";

/** Price of an advertise plan, in rupees. */
export function adPrice(plan: SellPlan, ads: { web: number; social: number }): number {
  return plan === "ad_social" ? ads.social : ads.web;
}

/**
 * Pay for an advertise plan by UPI: a QR (any UPI app) and an "open UPI app" link, then "I've paid".
 * A founder checks the bank and confirms; the ad goes live then. Used after listing and for renewals.
 */
export function AdPayment({ submissionId, number, plan, onDone }: { submissionId: string; number: number; plan: SellPlan; onDone?: () => void }) {
  const { data: config } = useAsync(getConfig, []);
  const [qr, setQr] = useState<string | null>(null);
  const { sending, done, error, send } = useSubmit();
  const ads = config?.ads;
  const price = ads ? adPrice(plan, ads) : 0;
  const upi =
    ads?.upi_id &&
    `upi://pay?${new URLSearchParams({ pa: ads.upi_id, pn: ads.upi_name, am: String(price), cu: "INR", tn: `LandFinder #${number}` })}`;

  useEffect(() => {
    if (upi) QRCode.toDataURL(upi, { margin: 1, width: 360 }).then(setQr, () => setQr(null));
  }, [upi]);

  if (!ads) return <div className="h-64 animate-pulse rounded-3xl bg-muted" />;
  if (done)
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <p className="font-semibold">{t("pay.thanks")}</p>
        {onDone && (
          <Button className="mt-5" variant="soft" onClick={onDone}>
            {t("common.done")}
          </Button>
        )}
      </div>
    );

  return (
    <div className="text-center">
      <p className="text-xl font-semibold">{t("pay.title", { price, days: ads.days })}</p>
      <p className="mt-0.5 text-sm text-sub">{t("pay.ref", { number })}</p>
      {upi ? (
        <>
          {qr && <img src={qr} alt="UPI QR" className="mx-auto mt-4 h-52 w-52 rounded-2xl bg-white p-2 shadow-[0_0_0_1px_var(--hairline)]" />}
          <p className="mt-2 text-sm text-sub">{t("pay.scan")}</p>
          <a href={upi} className={buttonVariants({ variant: "soft", size: "lg", className: "mt-3" })}>
            <Smartphone size={18} /> {t("pay.openApp")}
          </a>
          <p className="mt-2 text-sm text-sub">
            {t("pay.upiId")}: <b className="text-ink">{ads.upi_id}</b>
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm">{t("pay.noUpi")}</p>
      )}
      {error && <p className="mt-3 text-sm font-medium text-sold">{error}</p>}
      <Button
        variant="accent"
        size="lg"
        className="mt-4"
        disabled={sending}
        onClick={() => send(() => api(`/api/my/submissions/${submissionId}/payment-claim`, { method: "POST", device: true }))}
      >
        {t("pay.paid")}
      </Button>
      <p className="mt-2 text-xs text-sub">{t("pay.confirm")}</p>
    </div>
  );
}
