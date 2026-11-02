import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Contact, Listing } from "@/lib/api";
import { cents, inr, typeLabel } from "@/lib/format";
import { PhotoCarousel } from "./PhotoCarousel";
import { telLink, waLink } from "./contact";

const glassTag = "glass rounded-full px-3 py-1 text-[13px] font-medium text-ink";

/** Feed post: swipeable photos, price and facts, then clear labelled actions. */
export function ListingCard({ listing, contact }: { listing: Listing; contact: Contact }) {
  const nav = useNavigate();
  const sold = listing.status === "sold";
  const open = () => nav(`/p/${listing.id}`);

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <PhotoCarousel
        photos={listing.photos}
        type={listing.property_type}
        onOpen={open}
        className="aspect-[4/3] cursor-pointer"
        overlay={
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3">
            <span className={glassTag}>{sold ? "Sold" : typeLabel(listing.property_type)}</span>
            <span className={glassTag}>#{listing.number}</span>
          </div>
        }
      />

      <button onClick={open} className="block w-full px-5 pt-4 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <p className={sold ? "text-[22px] font-semibold text-sub line-through" : "text-[22px] font-semibold tracking-tight"}>
            {inr(listing.price)}
          </p>
          {listing.negotiable && !sold && <span className="text-sm font-medium text-brand">Negotiable</span>}
        </div>
        <p className="mt-1 line-clamp-1 text-[15px] text-ink">{listing.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-sub">
          <MapPin size={15} className="shrink-0" />
          <span className="truncate">
            {listing.location} · {cents(listing.land_area_cents)}
            {listing.distance_km != null && ` · ${listing.distance_km} km away`}
          </span>
        </p>
      </button>

      {sold ? (
        <div className="h-5" />
      ) : (
        <div className="mt-4 grid grid-cols-3 border-t border-line">
          <a href={waLink(contact, listing)} target="_blank" rel="noreferrer" className={action}>
            <MessageCircle size={18} className="text-wa" /> WhatsApp
          </a>
          <a href={telLink(contact)} className={`${action} border-x border-line`}>
            <Phone size={17} className="text-brand" /> Call
          </a>
          <Link to={`/p/${listing.id}?visit=1`} className={action}>
            <CalendarDays size={17} className="text-brand" /> Visit
          </Link>
        </div>
      )}
    </article>
  );
}

const action = "flex h-12 items-center justify-center gap-2 text-sm font-medium text-ink transition-colors hover:bg-muted";

export function ListingCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="aspect-[4/3] bg-muted" />
      <div className="space-y-2.5 p-5">
        <div className="h-6 w-28 rounded-full bg-muted" />
        <div className="h-4 w-56 rounded-full bg-muted" />
      </div>
    </div>
  );
}
