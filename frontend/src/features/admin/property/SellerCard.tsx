import { useState } from "react";
import { ChevronDown, FileCheck2, Pencil } from "lucide-react";
import { cents, inr, shortDate, typeLabel } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { ContactButtons } from "@/features/admin/ui";
import type { Property } from "@/features/admin/types";

/** The seller (private, founders only), with their original submission behind a toggle. */
export function SellerCard({ seller: s, onEdit }: { seller: Property["seller"]; onEdit?: () => void }) {
  const [showOriginal, setShowOriginal] = useState(false);
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-sub">Seller{onEdit ? " · added by LandFinder" : ""}</p>
        {onEdit && (
          <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>
      <p className="text-lg font-semibold">{s.seller_name}</p>
      <p className="text-sm text-sub">{s.seller_phone}</p>
      {s.wants_doc_help && (
        <p className="mt-2 flex items-center gap-2 rounded-2xl bg-accent-soft px-3 py-2 text-sm font-semibold">
          <FileCheck2 size={16} /> Asked for documentation assistance (paid)
        </p>
      )}
      {s.address && <p className="mt-1 mb-3 text-sm whitespace-pre-line">{s.address}</p>}
      {!s.address && <div className="mb-3" />}
      <ContactButtons phone={s.seller_phone} size="lg" />
      <button onClick={() => setShowOriginal(!showOriginal)} className="mt-3 flex w-full items-center justify-between py-1 text-sm font-medium text-sub">
        Seller's original details
        <ChevronDown size={18} className={cn("transition-transform", showOriginal && "rotate-180")} />
      </button>
      {showOriginal && (
        <dl className="mt-2 divide-y divide-line rounded-2xl bg-muted/60 text-sm">
          {[
            ["Type", typeLabel(s.property_type)],
            ["Area", cents(s.land_area_cents)],
            ["Asked price", inr(s.expected_price)],
            ["Negotiable", s.negotiable ? "Yes" : "No"],
            ["Documents", s.documents_available ? `Yes${s.documents_note ? ` — ${s.documents_note}` : ""}` : "Not yet uploaded"],
            ["Location", s.location],
            ["Full address", s.address || "—"],
            ["Submitted", shortDate(s.created_at)],
            ["Agreed to terms", `${s.consent_version} · ${shortDate(s.consent_at)}`],
            ["Description", s.description],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-sub">{k}</dt>
              <dd className="text-right font-medium whitespace-pre-line">{v}</dd>
            </div>
          ))}
          {s.status_note && <p className="px-4 py-3 text-sub">Note: {s.status_note}</p>}
        </dl>
      )}
    </section>
  );
}
