import { useState } from "react";
import { Link } from "react-router-dom";
import type { PublicConfig } from "@/shared/api/client";
import { Sheet } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "./Checkbox";

/** "I agree to the brokerage terms" tick box, with a sheet summarising the terms. */
export function BrokerageConsent({ agree, onChange, config }: { agree: boolean; onChange: (v: boolean) => void; config: PublicConfig | null | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3 card-sm p-3.5">
        <Checkbox checked={agree} onChange={onChange} label="I agree to the brokerage terms" className="border-line" />
        <p className="text-[15px]">
          I agree to the{" "}
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-brand underline underline-offset-2">
            brokerage terms
          </button>
        </p>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Brokerage terms">
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            Listing is <b>free</b>.
          </li>
          <li>
            Seller brokerage: <b>{config?.brokerage.seller_pct ?? 2}%</b>, only when the sale closes through LandFinder.
          </li>
          <li>Buyers pay {config?.brokerage.buyer_pct ?? 1}% separately.</li>
          <li>We confirm any price change with you before updating the listing.</li>
          <li>Your phone number and address are never shown to buyers.</li>
        </ul>
        <p className="mt-3 text-sm text-sub">
          Full details:{" "}
          <Link to="/terms" className="font-medium text-brand underline underline-offset-2">Terms of Service</Link>
          {" · "}
          <Link to="/privacy" className="font-medium text-brand underline underline-offset-2">Privacy Policy</Link>
        </p>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => {
            onChange(true);
            setOpen(false);
          }}
        >
          I agree
        </Button>
      </Sheet>
    </>
  );
}
