import { t } from "@/shared/i18n";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, FileCheck2, Handshake, MapPin, MessageCircle, Phone, Ruler } from "lucide-react";
import type { Contact, Listing } from "@/shared/api/client";
import { cents, isNew, priceDisplay, typeLabel } from "@/shared/lib/format";
import { PhotoCarousel } from "@/shared/components/PhotoCarousel";
import { cn } from "@/shared/lib/utils";
import { TYPE_TAG } from "@/shared/lib/propertyType";
import { telLink, waLink } from "@/shared/components/contact";
import { VisitSheet } from "@/shared/components/VisitSheet";

const tag = "rounded-full px-3 py-1 text-[13px] font-semibold shadow-sm";
const outlineTag = "bg-surface text-brand shadow-[inset_0_0_0_1.5px_var(--brand)]";
const fact = "flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-ink";

/** Feed post: photo, price and facts, then Call (main action), WhatsApp and Visit. */
export function ListingCard({ listing, contact, rera }: { listing: Listing; contact: Contact; rera?: string | null }) {
  const nav = useNavigate();
  const sold = listing.status === "sold";
  const price = priceDisplay(listing.price, listing.property_type, listing.land_area_cents);
  const open = () => nav(`/p/${listing.id}`);
  const [visitOpen, setVisitOpen] = useState(false);

  return (
    <article className="card overflow-hidden p-2">
      <PhotoCarousel
        photos={listing.photos}
        type={listing.property_type}
        onOpen={open}
        small
        className="aspect-[4/3] cursor-pointer rounded-[22px]"
        overlay={
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
              <div className="flex flex-wrap gap-1.5">
                <span className={cn(tag, sold ? "bg-sold-soft text-sold" : TYPE_TAG[listing.property_type])}>
                  {sold ? t("common.sold") : typeLabel(listing.property_type)}
                </span>
                {!sold && isNew(listing.listed_at) && <span className={cn(tag, outlineTag)}>{t("common.new")}</span>}
                {!sold && listing.price_reduced && <span className={cn(tag, outlineTag)}>{t("common.priceReduced")}</span>}
              </div>
            </div>
            {!sold && (
              <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1 text-[12px] font-semibold text-verified shadow-sm">
                <BadgeCheck size={14} /> {t("common.verified")}
              </span>
            )}
          </>
        }
      />

      <button onClick={open} className="block w-full px-3 pt-3 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <p className={sold ? "text-[24px] font-bold text-sub line-through" : "text-price text-[24px] font-bold tracking-tight"}>
            {price.main}
            {price.unit && <span className="ml-0.5 text-base font-semibold">{price.unit}</span>}
          </p>
          {price.side && !sold && <span className="text-sm font-medium text-sub">{price.side}</span>}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-sub">
          <MapPin size={15} className="shrink-0" />
          <span className="truncate">{listing.location}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[13px] font-medium">
          <span className={fact}>
            <Ruler size={14} className="text-land" /> {cents(listing.land_area_cents)}
          </span>
          {listing.documents_available && (
            <span className={cn(fact, "bg-verified-soft text-verified")}>
              <FileCheck2 size={14} /> {t("card.docsReady")}
            </span>
          )}
          {listing.negotiable && !sold && (
            <span className={fact}>
              <Handshake size={14} className="text-brand" /> {t("common.negotiable")}
            </span>
          )}
        </div>
        {rera && <p className="mt-2 text-xs text-sub">{t("common.rera")} {rera}</p>}
      </button>

      {sold ? (
        <div className="h-3" />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={telLink(contact)} className={cn(action, "btn-accent font-semibold")}>
            <Phone size={20} /> {t("common.call")}
          </a>
          <a href={waLink(contact, listing)} target="_blank" rel="noreferrer" className={cn(action, "bg-muted")}>
            <MessageCircle size={20} className="text-wa" /> {t("common.whatsapp")}
          </a>
          <button type="button" onClick={() => setVisitOpen(true)} className={cn(action, "bg-muted")}>
            <CalendarDays size={20} className="text-brand" /> {t("common.visit")}
          </button>
        </div>
      )}
      {/* Visit request opens right here, without leaving the list */}
      {!sold && <VisitSheet listingId={listing.id} open={visitOpen} onClose={() => setVisitOpen(false)} />}
    </article>
  );
}

// Three equal buttons; icon above the label so nothing feels cramped.
const action =
  "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-2 text-[13px] font-medium text-ink transition duration-200 hover:brightness-[0.97] active:scale-[0.97]";

export function ListingCardSkeleton() {
  return (
    <div className="card overflow-hidden p-2">
      <div className="shimmer aspect-[4/3] rounded-[22px]" />
      <div className="space-y-2.5 p-3">
        <div className="shimmer h-6 w-28 rounded-full" />
        <div className="shimmer h-4 w-56 rounded-full" />
      </div>
    </div>
  );
}
