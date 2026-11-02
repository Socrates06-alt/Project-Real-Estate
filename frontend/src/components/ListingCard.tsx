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
    <article className="card overflow-hidden p-2">
      <PhotoCarousel
        photos={listing.photos}
        type={listing.property_type}
        onOpen={open}
        className="aspect-[4/3] cursor-pointer rounded-[22px]"
        overlay={
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3">
            <span className={glassTag}>{sold ? "Sold" : typeLabel(listing.property_type)}</span>
            <span className={glassTag}>#{listing.number}</span>
          </div>
        }
      />

      <button onClick={open} className="block w-full px-3 pt-3 text-left">
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
          </span>
        </p>
      </button>

      {sold ? (
        <div className="h-3" />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <a href={waLink(contact, listing)} target="_blank" rel="noreferrer" className={action}>
            <MessageCircle size={18} className="text-wa" /> WhatsApp
          </a>
          <a href={telLink(contact)} className={action}>
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

const action =
  "flex h-11 items-center justify-center gap-1.5 rounded-[16px] bg-muted text-sm font-medium text-ink transition duration-200 hover:bg-brand-soft active:scale-[0.97]";

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
