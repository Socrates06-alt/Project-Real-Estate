import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, Clock3, FileCheck2, Handshake, MapPin, MessageCircle, Phone, Ruler } from "lucide-react";
import type { Contact, Listing } from "@/lib/api";
import { cents, inr, isNew, perCent, typeLabel, updatedAgo } from "@/lib/format";
import { PhotoCarousel } from "./PhotoCarousel";
import { cn } from "@/lib/utils";
import { TYPE_TAG } from "@/lib/propertyType";
import { telLink, waLink } from "./contact";

const tag = "rounded-full px-3 py-1 text-[13px] font-semibold shadow-sm";
const outlineTag = "bg-surface text-brand shadow-[inset_0_0_0_1.5px_var(--brand)]";
const fact = "flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-ink";

/** Feed post: photo, price and facts, then Call (main action), WhatsApp and Visit. */
export function ListingCard({ listing, contact, rera }: { listing: Listing; contact: Contact; rera?: string | null }) {
  const nav = useNavigate();
  const sold = listing.status === "sold";
  const open = () => nav(`/p/${listing.id}`);

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
                  {sold ? "Sold" : typeLabel(listing.property_type)}
                </span>
                {!sold && isNew(listing.listed_at) && <span className={cn(tag, outlineTag)}>New</span>}
                {!sold && listing.price_reduced && <span className={cn(tag, outlineTag)}>Price reduced</span>}
              </div>
            </div>
            {!sold && (
              <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1 text-[12px] font-semibold text-verified shadow-sm">
                <BadgeCheck size={14} /> Verified by LandFinder
              </span>
            )}
          </>
        }
      />

      <button onClick={open} className="block w-full px-3 pt-3 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <p className={sold ? "text-[24px] font-bold text-sub line-through" : "text-price text-[24px] font-bold tracking-tight"}>
            {inr(listing.price)}
          </p>
          {listing.property_type === "land" && !sold && (
            <span className="text-sm font-medium text-sub">{perCent(listing.price, listing.land_area_cents)}</span>
          )}
        </div>
        <p className="mt-1 line-clamp-1 text-[15px] text-ink">{listing.title}</p>
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
              <FileCheck2 size={14} /> Documents ready
            </span>
          )}
          {listing.negotiable && !sold && (
            <span className={fact}>
              <Handshake size={14} className="text-brand" /> Negotiable
            </span>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-sub">
          <span className="flex items-center gap-1 text-verified">
            <Clock3 size={13} /> {updatedAgo(listing.published_at)}
          </span>
          {rera && <span>· RERA {rera}</span>}
        </p>
      </button>

      {sold ? (
        <div className="h-3" />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={telLink(contact)} className={cn(action, "btn-accent font-semibold")}>
            <Phone size={20} /> Call
          </a>
          <a href={waLink(contact, listing)} target="_blank" rel="noreferrer" className={cn(action, "bg-muted")}>
            <MessageCircle size={20} className="text-wa" /> WhatsApp
          </a>
          <Link to={`/p/${listing.id}?visit=1`} className={cn(action, "bg-muted")}>
            <CalendarDays size={20} className="text-brand" /> Visit
          </Link>
        </div>
      )}
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
