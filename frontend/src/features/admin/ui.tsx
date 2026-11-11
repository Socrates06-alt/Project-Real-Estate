import { TYPE_ICON } from "@/shared/lib/propertyType";
import { useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import type { PropertyType } from "@/shared/api/client";
import { Badge } from "@/shared/ui/badge";
import { useToast } from "@/shared/ui/toast";
import { timeAgo } from "@/shared/lib/format";
import { sourceLabel } from "@/shared/lib/source";
import { cn } from "@/shared/lib/utils";
import { useAdmin, usePrivateImage } from "@/features/admin/auth";
import type { Group, Visit } from "@/features/admin/types";

export const GROUP_LABEL: Record<Group, string> = { new: "New", live: "Live", sold: "Sold", not_listed: "Not listed", removed: "Removed" };
const GROUP_TONE: Record<Group, "sky" | "brand" | "sold" | "gray"> = {
  new: "sky",
  live: "brand",
  sold: "sold",
  not_listed: "gray",
  removed: "gray",
};

export const GroupBadge = ({ group }: { group: Group }) => <Badge tone={GROUP_TONE[group]}>{GROUP_LABEL[group]}</Badge>;

/** Private (admin-only) photo, fetched with the admin token. */
export function PrivatePhoto({ url, type, className }: { url: string | null; type: PropertyType; className?: string }) {
  const src = usePrivateImage(url ?? "");
  const Icon = TYPE_ICON[type];
  return (
    <div className={cn("grid place-items-center overflow-hidden bg-brand-soft text-brand/50", className)}>
      {url && src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Icon size={22} />}
    </div>
  );
}

export function ContactButtons({ phone, size = "md" }: { phone: string; size?: "md" | "lg" }) {
  const digits = phone.replace(/\D/g, "");
  const cls = cn(
    "flex flex-1 items-center justify-center gap-2 rounded-full font-medium",
    size === "lg" ? "h-12 text-[15px]" : "h-10 text-sm",
  );
  return (
    <div className="flex gap-2">
      <a href={`tel:${phone}`} className={cn(cls, "bg-surface shadow-[0_0_0_1px_var(--hairline)]")}>
        <Phone size={17} className="text-brand" /> Call
      </a>
      <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={cn(cls, "bg-wa text-white")}>
        <MessageCircle size={17} /> WhatsApp
      </a>
    </div>
  );
}

const STEPS: [Visit["status"], string][] = [
  ["contacted", "Contacted"],
  ["scheduled", "Visit fixed"],
  ["done", "Done"],
];
const ORDER = { new: 0, contacted: 1, scheduled: 2, done: 3, cancelled: -1 };

/** Visit request with call buttons and 3 big progress steps. */
export function VisitCard({ visit, onChange, showListing }: { visit: Visit; onChange: () => void; showListing?: boolean }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function set(status: Visit["status"]) {
    setBusy(true);
    try {
      await call(`/visits/${visit.id}`, { method: "PATCH", body: { status } });
      onChange();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cancelled = visit.status === "cancelled";
  const digits = visit.phone.replace(/\D/g, "");
  const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-full";
  return (
    <div className="card p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{visit.name}</p>
          <p className="truncate text-sm text-sub">
            {visit.preferred_time || "Any time"}
            {visit.budget && ` · ${visit.budget}`} · {timeAgo(visit.created_at)} ago
            {visit.came_from && ` · from ${sourceLabel(visit.came_from)}`}
          </p>
          {showListing && visit.listing_number && (
            <p className="truncate text-sm text-sub">
              #{visit.listing_number} {visit.listing_title}
            </p>
          )}
        </div>
        <a href={`tel:${visit.phone}`} aria-label={`Call ${visit.name}`} className={cn(iconBtn, "bg-surface shadow-[0_0_0_1px_var(--hairline)]")}>
          <Phone size={17} className="text-brand" />
        </a>
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${visit.name}`} className={cn(iconBtn, "bg-wa text-white")}>
          <MessageCircle size={17} />
        </a>
      </div>
      {cancelled ? (
        <p className="mt-2 text-sm text-sub">Cancelled</p>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5">
          {STEPS.map(([status, label]) => {
            const reached = ORDER[visit.status] >= ORDER[status];
            return (
              <button
                key={status}
                disabled={busy}
                onClick={() => set(status)}
                className={cn("h-9 flex-1 rounded-xl text-[13px] font-medium transition-colors", reached ? "bg-brand text-brand-ink" : "bg-muted text-sub")}
              >
                {label}
              </button>
            );
          })}
          {visit.status !== "done" && (
            <button
              disabled={busy}
              aria-label="Cancel visit"
              title="Cancel visit"
              onClick={() => window.confirm("Cancel this visit request?") && set("cancelled")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-sub"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
