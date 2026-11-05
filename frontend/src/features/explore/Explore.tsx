import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUp, ChevronDown, ChevronRight, House, LocateFixed, MapPin, Search, SearchX, X } from "lucide-react";
import { Logo } from "@/shared/components/Logo";
import { FilterTiles, type PropertyFilter } from "@/features/explore/FilterTiles";
import { Sheet } from "@/shared/ui/sheet";
import { useToast } from "@/shared/ui/toast";
import { getMyLocation, isNearTaluk } from "@/shared/lib/geo";
import { loadArea, markNearMeAsked, nearMeAsked, saveArea, type SavedArea } from "@/features/explore/savedArea";
import { api, getConfig, type Feed, type Listing } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";
import { useAsync } from "@/shared/lib/useAsync";
import { useNewListings } from "./useNewListings";
import { ListingCard, ListingCardSkeleton } from "@/features/explore/ListingCard";
import { EmptyState, ErrorState } from "@/shared/components/States";
import { Button } from "@/shared/ui/button";

type TypeFilter = PropertyFilter;
const PAGE = 10;

export default function Explore() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [extra, setExtra] = useState<Listing[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Area chosen on the map: /?lat=..&lng=..&r=5&place=Puliyoor
  const [params, setParams] = useSearchParams();
  const area =
    params.get("lat") && params.get("lng")
      ? { lat: params.get("lat")!, lng: params.get("lng")!, r: params.get("r") || "5", place: params.get("place") || "Selected area" }
      : null;
  const areaKey = area ? `${area.lat},${area.lng},${area.r}` : "";

  // Remember the chosen area on this phone; reopen with it next time.
  const setArea = (a: SavedArea | null) => {
    if (!a) saveArea(null); // "All areas": forget it too
    setParams(a ? { ...a } : {}, { replace: true });
  };
  useEffect(() => {
    if (area) saveArea(area);
    else if (!params.toString()) {
      const saved = loadArea();
      if (saved) setArea(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const query = (offset: number) => {
    const p = new URLSearchParams({ q, status: "live", limit: String(PAGE), offset: String(offset) });
    if (type !== "all") p.set("type", type);
    if (area) {
      p.set("lat", area.lat);
      p.set("lng", area.lng);
      p.set("radius_km", area.r);
    }
    return api<Feed>(`/api/listings?${p}`);
  };

  const { data, error, loading, reload } = useAsync(async () => {
    const feed = await query(0);
    setExtra([]);
    setHasMore(feed.has_more);
    return feed;
  }, [q, type, areaKey]);
  const config = useAsync(getConfig, []);
  const fresh = useNewListings(data, () => query(0), reload);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await query(PAGE + extra.length);
      setExtra((e) => [...e, ...next.items]);
      setHasMore(next.has_more);
    } finally {
      setLoadingMore(false);
    }
  }

  const items = [...(data?.items ?? []), ...extra];
  const contact = data?.contact ?? config.data?.contact;
  // The welcome sections show only on the plain Home view (no search, area or filters).
  const isHome = !q && !area && type === "all";

  return (
    <div>
      <header className="brand-header sticky top-0 z-30 -mx-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 shadow-float">
        <div className="mb-3 flex items-center justify-between">
          <Logo light />
          <LocationButton area={area} onClear={() => setArea(null)} />
        </div>
        <div className="search-pill flex h-[52px] min-w-0 items-center gap-3 rounded-full px-5">
          <Search size={20} className="shrink-0 text-brand" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search area, budget or type"
            aria-label="Search properties"
            className="min-w-0 flex-1 bg-transparent text-base text-ink caret-[var(--brand)] outline-none"
          />
          {input && (
            <button aria-label="Clear search" onClick={() => setInput("")} className="grid h-8 w-8 place-items-center rounded-full text-sub hover:bg-muted">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {fresh.hasNew && (
        <div className="pointer-events-none sticky top-[calc(max(0.75rem,env(safe-area-inset-top))+150px)] z-40 flex h-0 justify-center">
          <button
            onClick={fresh.showNew}
            className="animate-fade pointer-events-auto mt-2 flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink shadow-float"
          >
            <ArrowUp size={16} strokeWidth={2.5} /> New properties
          </button>
        </div>
      )}

      <div className="space-y-4 pt-4">
        <FilterTiles type={type} onType={setType} />
        {!area && <NearYouPopup onArea={setArea} />}
        {isHome && <SellBanner />}
        {isHome && data && items.length > 0 && <h2 className="px-1 pt-1 font-semibold">All properties</h2>}
        {loading && !data && [0, 1].map((i) => <ListingCardSkeleton key={i} />)}
        {error && <ErrorState message={error.message} retry={reload} />}
        {data && contact && items.map((l) => <ListingCard key={l.id} listing={l} contact={contact} rera={config.data?.rera_number} />)}
        {data && !items.length && (
          <EmptyState
            icon={<SearchX size={28} />}
            title={area ? "No properties in this area" : "Nothing matches yet"}
            text="Try a nearby area or a wider budget. New properties are added every week."
          />
        )}
        {hasMore && (
          <Button variant="outline" size="lg" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Loading…" : "Show more"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SellBanner() {
  return (
    <Link to="/sell" className="card card-hover flex items-center gap-4 bg-brand-soft p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink shadow-sm">
        <House size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Selling a property?</p>
        <p className="text-sm text-sub">List it free. Pay only when it sells.</p>
      </div>
      <ChevronRight size={20} className="shrink-0 text-sub" />
    </Link>
  );
}

/** Top-right location: "All areas ▾" or "Puliyoor · 5 km ▾". Tap to choose on the map. */
function LocationButton({ area, onClear }: { area: SavedArea | null; onClear: () => void }) {
  const to = area
    ? `/map?lat=${area.lat}&lng=${area.lng}&r=${area.r}&place=${encodeURIComponent(area.place)}`
    : "/map";
  return (
    <div
      className={cn(
        "flex h-10 max-w-[60%] items-center rounded-full text-sm font-medium transition duration-200",
        area
          ? "bg-brand-soft text-brand shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_35%,transparent)]"
          : "bg-surface text-ink shadow-[0_0_0_1px_var(--hairline)]",
      )}
    >
      <Link to={to} aria-label="Choose area" className="flex min-w-0 items-center gap-1.5 py-2 pr-2 pl-3">
        <MapPin size={16} className="shrink-0" />
        <span className="truncate">{area ? `${area.place} · ${area.r} km` : "All areas"}</span>
        <ChevronDown size={16} className="shrink-0" />
      </Link>
      {area && (
        <button aria-label="Show all areas" onClick={onClear} className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-brand/10">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/** One-time, gentle popup offering to show properties near the buyer (only useful near the taluk). */
function NearYouPopup({ onArea }: { onArea: (a: SavedArea) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (nearMeAsked()) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    markNearMeAsked();
    setOpen(false);
  };

  async function useLocation() {
    setBusy(true);
    try {
      const me = await getMyLocation();
      if (isNearTaluk(me)) onArea({ lat: me.lat.toFixed(5), lng: me.lng.toFixed(5), r: "5", place: "Near you" });
      else toast("You're outside Chengannur — showing all areas");
    } catch {
      toast("Location not available — showing all areas");
    } finally {
      setBusy(false);
      close();
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Looking near where you are?">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <LocateFixed size={22} />
        </span>
        <p className="text-[15px] text-sub">We can show properties around you. You can change the area any time from the top right.</p>
      </div>
      <div className="mt-5 grid gap-2">
        <Button size="lg" disabled={busy} onClick={useLocation}>
          {busy ? "Finding you…" : "Use my location"}
        </Button>
        <Button size="lg" variant="ghost" onClick={close}>
          No thanks
        </Button>
      </div>
    </Sheet>
  );
}
