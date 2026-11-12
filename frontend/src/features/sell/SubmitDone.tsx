import { t } from "@/shared/i18n";
import { Link } from "react-router-dom";
import { Check, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";

/** Shown after a successful submission. */
export function SubmitDone({ contactWa }: { contactWa?: string }) {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <Check size={30} strokeWidth={2.5} />
      </div>
      <h1 className="text-2xl font-semibold">{t("sell.doneTitle")}</h1>
      <p className="mt-2 max-w-xs text-sub">{t("sell.doneText")}</p>
      <div className="mt-8 w-full max-w-sm space-y-2.5">
        {contactWa && (
          <a href={contactWa} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "wa", size: "lg" })}>
            <MessageCircle size={19} /> {t("sell.messageWa")}
          </a>
        )}
        <Link to="/me" className={buttonVariants({ variant: "soft", size: "lg" })}>
          {t("sell.track")}
        </Link>
      </div>
    </div>
  );
}
