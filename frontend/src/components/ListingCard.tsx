import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Contact, Listing } from "@/lib/api";
import { cents, inr, timeAgo, typeLabel } from "@/lib/format";
import { Badge } from "./ui/badge";
import { PhotoCarousel } from "./PhotoCarousel";
import { telLink, waLink } from "./contact";

/** A feed "post": header, swipeable photos, quick actions, price + facts. */
export function ListingCard({ listing, contact }: { listing: Listing; contact: Contact }) {
  const nav = useNavigate();
  const sold = listing.status === "sold";
  const open = () => nav(`/p/${listing.id}`);

  return (
    <article className="overflow-hidden rounded-[28px] bg-surface shadow-card">
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-emerald-400 p-[2px]">
          <span className="grid h-full w-full place-items-center rounded-full bg-surface text-brand">
            <MapPin size={16} />
          </span>
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold">{listing.location}</p>
          <p className="text-xs text-sub">
            #{listing.number} · {timeAgo(listing.published_at)}
          </p>
        </div>
        <Badge tone={listing.property_type === "house" ? "brand" : "amber"}>{typeLabel(listing.property_type)}</Badge>
      </header>

      <PhotoCarousel
        photos={listing.photos}
        type={listing.property_type}
        onOpen={open}
        className="mx-3 aspect-[4/3.4] cursor-pointer rounded-3xl"
        overlay={
          sold && (
            <Badge tone="glass" className="absolute top-3 left-3 bg-sold/90">
              Sold
            </Badge>
          )
        }
      />

      <div className="px-4 pt-3 pb-4">
        {!sold && (
          <div className="-ml-2 mb-1 flex items-center gap-1">
            <a href={waLink(contact, listing)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 place-items-center rounded-full text-wa hover:bg-muted">
              <MessageCircle size={23} />
            </a>
            <a href={telLink(contact)} aria-label="Call" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
              <Phone size={21} />
            </a>
            <Link to={`/p/${listing.id}?visit=1`} aria-label="Request visit" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
              <CalendarDays size={22} />
            </Link>
          </div>
        )}
        <button onClick={open} className="block w-full text-left">
          <div className="flex items-baseline justify-between gap-3">
            <p className={sold ? "text-xl font-extrabold text-sub line-through decoration-2" : "text-xl font-extrabold"}>
              {inr(listing.price)}
            </p>
            {listing.negotiable && !sold && <span className="text-xs font-semibold text-brand">Negotiable</span>}
          </div>
          <p className="mt-0.5 text-sm text-sub">
            {cents(listing.land_area_cents)} · {listing.title}
          </p>
        </button>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[28px] bg-surface p-3 shadow-card">
      <div className="mb-3 flex items-center gap-3 px-1">
        <div className="h-9 w-9 rounded-full bg-muted" />
        <div className="h-3 w-32 rounded-full bg-muted" />
      </div>
      <div className="aspect-[4/3.4] rounded-3xl bg-muted" />
      <div className="mt-4 h-5 w-24 rounded-full bg-muted" />
      <div className="mt-2 mb-2 h-3 w-48 rounded-full bg-muted" />
    </div>
  );
}
