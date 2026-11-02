import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, FileCheck2, Handshake, MapPin, MessageCircle, Phone, Ruler } from "lucide-react";
import type { Contact, Listing } from "@/lib/api";
import { cents, inr, isNew, perCent, typeLabel } from "@/lib/format";
import { PhotoCarousel } from "./PhotoCarousel";
import { cn } from "@/lib/utils";
import { telLink, waLink } from "./contact";

const glassTag = "glass rounded-full px-3 py-1 text-[13px] font-medium text-ink";
const tag = "rounded-full px-3 py-1 text-[13px] font-semibold shadow-sm";
const fact = "flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-ink";

/** Feed post: swipeable photos, price and facts, then clear labelled actions. */
export function ListingCard({ listing, contact }: { listing: Listing; contact: Contact }) {
  const nav = useNavigate();
  const sold = listing.status === "sold";
  const open = () => nav(`/p/${listing.id}`);

  return (
    <article className="card overflow-hidden p-2">
      <PhotoCarousel
        photos={listing.photos}
        type={listing.property_type}
        onOpen={open}
        className="aspect-[4/3] cursor-pointer rounded-[22px]"
        overlay={
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
              <div className="flex flex-wrap gap-1.5">
                <span className={cn(tag, sold ? "bg-sold-soft text-sold" : listing.property_type === "house" ? "bg-house-soft text-house" : "bg-land-soft text-land")}>
                  {sold ? "Sold" : typeLabel(listing.property_type)}
                </span>
                {!sold && isNew(listing.listed_at) && <span className={cn(tag, "bg-accent text-accent-ink")}>New</span>}
                {!sold && listing.price_reduced && <span className={cn(tag, "bg-accent text-accent-ink")}>Price reduced</span>}
              </div>
              <span className={glassTag}>#{listing.number}</span>
            </div>
            {!sold && (
              <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[12px] font-semibold text-[#1d5fa8] shadow-sm">
                <BadgeCheck size={14} /> Verified by Nilayam
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
            <span className={fact}>
              <FileCheck2 size={14} className="text-house" /> Documents ready
            </span>
          )}
          {listing.negotiable && !sold && (
            <span className={fact}>
              <Handshake size={14} className="text-brand" /> Negotiable
            </span>
          )}
        </div>
      </button>

      {sold ? (
        <div className="h-3" />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <a href={waLink(contact, listing)} target="_blank" rel="noreferrer" className={cn(action, "bg-[color-mix(in_srgb,var(--wa)_14%,var(--surface))]")}>
            <MessageCircle size={18} className="text-wa" /> WhatsApp
          </a>
          <a href={telLink(contact)} className={cn(action, "bg-sky")}>
            <Phone size={17} className="text-sky-ink" /> Call
          </a>
          <Link to={`/p/${listing.id}?visit=1`} className={cn(action, "bg-accent-soft")}>
            <CalendarDays size={17} className="text-[var(--accent-strong)]" /> Visit
          </Link>
        </div>
      )}
    </article>
  );
}

const action =
  "flex h-11 items-center justify-center gap-1.5 rounded-[16px] text-sm font-medium text-ink transition duration-200 hover:brightness-[0.97] active:scale-[0.97]";

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
