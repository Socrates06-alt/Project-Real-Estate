import { useState } from "react";
import { Link } from "react-router-dom";
import { mediaUrl, type Listing } from "@/shared/api/client";
import { cents, priceDisplay, typeLabel } from "@/shared/lib/format";
import { TYPE_ICON } from "@/shared/lib/propertyType";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

/** Small property card (photo, price, type · size, place · km): similar properties and the Saved list. */
export function PropertyMiniCard({ p, km, className, corner }: { p: Listing; km?: number | null; className?: string; corner?: React.ReactNode }) {
  const price = priceDisplay(p.price, p.property_type, p.land_area_cents);
  const Icon = TYPE_ICON[p.property_type];
  const full = p.photos[0] ? mediaUrl(p.photos[0]) : "";
  const [src, setSrc] = useState(full.replace(/\.webp$/, "-sm.webp"));
  const sold = p.status === "sold";
  return (
    <Link to={`/p/${p.id}`} className={cn("card relative block overflow-hidden", className)}>
      <div className="grid h-28 place-items-center overflow-hidden bg-brand-soft text-brand/50">
        {full ? (
          <img src={src} alt="" loading="lazy" onError={() => src !== full && setSrc(full)} className="h-full w-full object-cover" />
        ) : (
          <Icon size={26} />
        )}
      </div>
      {corner && <div className="absolute top-2 right-2">{corner}</div>}
      <div className="space-y-0.5 px-3 pt-2.5 pb-3">
        <p className={cn("text-[15px] leading-tight font-semibold", sold && "text-sub line-through")}>
          {price.main}
          <span className="text-xs font-normal text-sub">{price.unit}</span>
        </p>
        <p className="truncate text-xs text-sub">
          {sold ? t("common.sold") : typeLabel(p.property_type)} · {cents(p.land_area_cents)}
        </p>
        <p className="truncate text-xs text-sub">
          {p.location}
          {km != null && ` · ${km < 1 ? "<1" : Math.round(km)} km`}
        </p>
      </div>
    </Link>
  );
}
