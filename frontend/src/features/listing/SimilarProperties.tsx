import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MapPin, SearchCheck } from "lucide-react";
import { api, mediaUrl, type Listing } from "@/shared/api/client";
import { cents, priceDisplay, typeLabel } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { TYPE_ICON } from "@/shared/lib/propertyType";
import { REQUEST_LABEL } from "@/shared/lib/labels";

type Similar = Listing & { km: number | null };
type Place = { place: string; count: number; lat: number | null; lng: number | null };

/** Below a property: similar ones (any place, nearest first), every place with properties, and a way out. */
export function SimilarProperties({ listingId }: { listingId: string }) {
  const { data } = useAsync(() => api<{ similar: Similar[]; places: Place[] }>(`/api/listings/${listingId}/similar`), [listingId]);
  if (!data) return null;
  return (
    <div className="mt-6 space-y-5">
      {data.similar.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-base font-semibold">Similar properties</h2>
          <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {data.similar.map((s) => (
              <SimilarCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      {data.places.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-base font-semibold">Browse by place</h2>
          <div className="flex flex-wrap gap-2">
            {data.places.map((p) => (
              <Link
                key={p.place}
                to={p.lat != null ? `/?lat=${p.lat}&lng=${p.lng}&r=3&place=${encodeURIComponent(p.place)}` : "/"}
                className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-medium shadow-[0_0_0_1px_var(--hairline)]"
              >
                <MapPin size={14} className="text-brand" /> {p.place}
                <span className="text-sub">{p.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link to="/" className="flex h-12 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">
        See all properties
      </Link>
      <Link to="/request" className="flex items-center gap-3 rounded-2xl px-1 py-1 text-sm">
        <SearchCheck size={18} className="shrink-0 text-brand" />
        <span className="flex-1">
          <b>Didn't find it?</b> <span className="text-sub">{REQUEST_LABEL}. We'll call you.</span>
        </span>
        <ChevronRight size={16} className="text-sub" />
      </Link>
    </div>
  );
}

function SimilarCard({ s }: { s: Similar }) {
  const price = priceDisplay(s.price, s.property_type, s.land_area_cents);
  const Icon = TYPE_ICON[s.property_type];
  const full = s.photos[0] ? mediaUrl(s.photos[0]) : "";
  const [src, setSrc] = useState(full.replace(/\.webp$/, "-sm.webp"));
  return (
    <Link to={`/p/${s.id}`} className="card w-[46%] min-w-[150px] shrink-0 snap-start overflow-hidden">
      <div className="grid aspect-[4/3] place-items-center bg-brand-soft text-brand/50">
        {full ? (
          <img src={src} alt="" loading="lazy" onError={() => src !== full && setSrc(full)} className="h-full w-full object-cover" />
        ) : (
          <Icon size={26} />
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[15px] leading-tight font-semibold">
          {price.main}
          <span className="text-xs font-normal text-sub">{price.unit}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-sub">
          {typeLabel(s.property_type)} · {cents(s.land_area_cents)}
        </p>
        <p className="truncate text-xs text-sub">
          {s.location}
          {s.km != null && ` · ${s.km < 1 ? "<1" : Math.round(s.km)} km`}
        </p>
      </div>
    </Link>
  );
}
