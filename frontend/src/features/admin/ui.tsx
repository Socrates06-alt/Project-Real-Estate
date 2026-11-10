import { TYPE_ICON } from "@/shared/lib/propertyType";
import { useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import type { PropertyType } from "@/shared/api/client";
import { Badge } from "@/shared/ui/badge";
import { useToast } from "@/shared/ui/toast";
import { timeAgo } from "@/shared/lib/format";
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
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{visit.name}</p>
          <p className="text-sm text-sub">
            {visit.preferred_time || "Any time"}
            {visit.budget && ` · ${visit.budget}`}
          </p>
          {showListing && visit.listing_number && (
            <p className="mt-0.5 truncate text-sm text-sub">
              #{visit.listing_number} {visit.listing_title}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-sub">{timeAgo(visit.created_at)} ago</span>
      </div>
      <div className="mt-3">
        <ContactButtons phone={visit.phone} />
      </div>
      {cancelled ? (
        <p className="mt-3 text-center text-sm text-sub">Cancelled</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {STEPS.map(([status, label]) => {
              const reached = ORDER[visit.status] >= ORDER[status];
              return (
                <button
                  key={status}
                  disabled={busy}
                  onClick={() => set(status)}
                  className={cn(
                    "h-11 rounded-2xl text-sm font-medium transition-colors",
                    reached ? "bg-brand text-brand-ink" : "bg-muted text-sub",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {visit.status !== "done" && (
            <button disabled={busy} onClick={() => set("cancelled")} className="mt-2 w-full text-center text-sm text-sub">
              Cancel visit
            </button>
          )}
        </>
      )}
    </div>
  );
}
