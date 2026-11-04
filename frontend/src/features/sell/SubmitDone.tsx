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
      <h1 className="text-2xl font-semibold">Submission received</h1>
      <p className="mt-2 max-w-xs text-sub">We'll call you within 24 hours to confirm the details.</p>
      <div className="mt-8 w-full max-w-sm space-y-2.5">
        {contactWa && (
          <a href={contactWa} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "wa", size: "lg" })}>
            <MessageCircle size={19} /> Message us on WhatsApp
          </a>
        )}
        <Link to="/me" className={buttonVariants({ variant: "soft", size: "lg" })}>
          Track in My listings
        </Link>
      </div>
    </div>
  );
}
