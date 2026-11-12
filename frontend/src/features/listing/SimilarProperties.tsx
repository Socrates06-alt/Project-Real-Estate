import { t } from "@/shared/i18n";
import { Link } from "react-router-dom";
import { LayoutGrid, MapPin, SearchCheck } from "lucide-react";
import { api, type Listing } from "@/shared/api/client";
import { PropertyMiniCard } from "@/shared/components/PropertyMiniCard";
import { useAsync } from "@/shared/lib/useAsync";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type Similar = Listing & { km: number | null };
type Place = { place: string; count: number; lat: number | null; lng: number | null };

/** Below a property: similar ones (any place, nearest first), more in the same place, all properties, and a way out. */
export function SimilarProperties({ listingId, place }: { listingId: string; place: string }) {
  const { data } = useAsync(() => api<{ similar: Similar[]; places: Place[] }>(`/api/listings/${listingId}/similar`), [listingId]);
  if (!data) return null;
  const here = data.places.find((p) => p.place === place);
  return (
    <div className="mt-6 space-y-5">
      {data.similar.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-base font-semibold">{t("similar.title")}</h2>
          <div className="-mx-4 flex snap-x scroll-px-4 items-start gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {data.similar.map((s) => (
              <PropertyMiniCard key={s.id} p={s} km={s.km} className="w-[44%] min-w-[150px] max-w-[190px] shrink-0 snap-start" />
            ))}
          </div>
        </section>
      )}

      {/* Two clear, big choices: this place, or everything */}
      <div className={cn("grid gap-2.5", here && here.count > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {here && here.count > 1 && (
          <Link
            to={here.lat != null ? `/?lat=${here.lat}&lng=${here.lng}&r=3&place=${encodeURIComponent(here.place)}` : "/"}
            className="card flex min-h-[64px] items-center gap-3 px-4 py-3 active:scale-[0.99]"
          >
            <MapPin size={22} className="shrink-0 text-brand" />
            <span className="min-w-0 leading-tight">
              <span className="block text-xs text-sub">{t("similar.moreIn")}</span>
              <span className="block truncate text-base font-semibold">{here.place}</span>
            </span>
          </Link>
        )}
        <Link to="/" className="card flex min-h-[64px] items-center gap-3 px-4 py-3 active:scale-[0.99]">
          <LayoutGrid size={22} className="shrink-0 text-brand" />
          <span className="min-w-0 leading-tight">
            <span className="block text-xs text-sub">{t("similar.seeAll")}</span>
            <span className="block text-base font-semibold">{t("similar.properties")}</span>
          </span>
        </Link>
      </div>

      {/* Didn't find it: a clear, friendly box with one obvious button */}
      <section className="rounded-[24px] bg-brand-soft p-5">
        <div className="flex items-start gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink">
            <SearchCheck size={24} />
          </span>
          <div>
            <p className="text-lg leading-snug font-semibold">{t("similar.didntFind")}</p>
            <p className="mt-0.5 text-[15px] text-sub">{t("similar.tellUs")}</p>
          </div>
        </div>
        <Link to="/request" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-4")}>
          {t("request.post")}
        </Link>
      </section>
    </div>
  );
}
