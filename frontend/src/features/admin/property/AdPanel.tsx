import { useState } from "react";
import { Check, Megaphone } from "lucide-react";
import type { SellPlan } from "@/shared/api/client";
import { shortDate } from "@/shared/lib/format";
import { Segmented } from "@/shared/ui/segmented";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { useAdmin } from "@/features/admin/auth";
import type { Property } from "@/features/admin/types";

/** How the seller sells: "we sell it" (commission) or an advertise plan, with payment, expiry and FB/IG posting. */
export function AdPanel({ p, reload }: { p: Property; reload: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const s = p.seller;
  const [busy, setBusy] = useState(false);
  const ad = s.plan !== "commission";
  const live = !!s.ad_expires_at && new Date(s.ad_expires_at).getTime() > Date.now();
  const claimed = !!s.payment_claimed_at && (!s.paid_at || s.payment_claimed_at > s.paid_at);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done);
      reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Megaphone size={18} className="text-brand" /> How it's sold
      </h2>
      <Segmented<SellPlan>
        value={s.plan}
        onChange={(plan) => run(() => call(`/properties/${p.id}/plan`, { method: "PUT", body: { plan } }), "Plan changed")}
        options={[
          { value: "commission", label: "We sell it" },
          { value: "ad_web", label: "Ad: website" },
          { value: "ad_social", label: "Ad: + FB/IG" },
        ]}
      />
      {ad && (
        <>
          <div className="rounded-2xl bg-muted/70 px-4 py-3 text-sm">
            {live ? (
              <p>
                <b className="text-verified">Paid ✓</b> · shown until <b>{shortDate(s.ad_expires_at!)}</b>
              </p>
            ) : (
              <p>
                <b className="text-sold">Not live:</b> {s.ad_expires_at ? `ended ${shortDate(s.ad_expires_at)}` : "not paid yet"}
              </p>
            )}
            {claimed && <p className="mt-1 font-semibold text-brand">Seller says they paid · check the bank</p>}
          </div>
          <Button disabled={busy} onClick={() => run(() => call(`/properties/${p.id}/paid`, { method: "POST" }), "Payment confirmed")}>
            <Check size={18} /> Mark paid (+30 days)
          </Button>
          <Switch
            checked={!!s.ad_posted}
            onChange={(posted) => run(() => call(`/properties/${p.id}/posted`, { method: "PUT", body: { posted } }), posted ? "Marked posted" : "Unmarked")}
            label="Posted on Facebook & Instagram"
          />
        </>
      )}
    </section>
  );
}
