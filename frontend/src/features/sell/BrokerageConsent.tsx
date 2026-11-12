import { t } from "@/shared/i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { PublicConfig } from "@/shared/api/client";
import { Sheet } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/components/form/Checkbox";

/** "I agree to the brokerage terms" tick box, with a sheet summarising the terms. */
export function BrokerageConsent({ agree, onChange, config }: { agree: boolean; onChange: (v: boolean) => void; config: PublicConfig | null | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3 card-sm p-3.5">
        <Checkbox checked={agree} onChange={onChange} label={t("sell.agreeAria")} className="border-line" />
        <p className="text-[15px]">
          {t("sell.agreeTo")}{" "}
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-brand underline underline-offset-2">
            {t("sell.brokerageTerms")}
          </button>
        </p>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("sell.termsTitle")}>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li className="font-medium">{t("sell.termFree")}</li>
          <li>{t("sell.termSeller", { pct: config?.brokerage.seller_pct ?? 2 })}</li>
          <li>{t("sell.termBuyer", { pct: config?.brokerage.buyer_pct ?? 1 })}</li>
          <li>{t("sell.termPrice")}</li>
          <li>{t("sell.termPrivate")}</li>
        </ul>
        <p className="mt-3 text-sm text-sub">
          {t("sell.fullDetails")}{" "}
          <Link to="/terms" className="font-medium text-brand underline underline-offset-2">{t("common.terms")}</Link>
          {" · "}
          <Link to="/privacy" className="font-medium text-brand underline underline-offset-2">{t("common.privacy")}</Link>
        </p>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => {
            onChange(true);
            setOpen(false);
          }}
        >
          {t("sell.iAgree")}
        </Button>
      </Sheet>
    </>
  );
}
