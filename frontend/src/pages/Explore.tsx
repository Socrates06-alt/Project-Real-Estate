import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, House, LocateFixed, MapPin, Search, SearchX, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useToast } from "@/components/ui/toast";
import { getMyLocation, isNearTaluk } from "@/lib/geo";
import { loadArea, markNearMeAsked, nearMeAsked, saveArea, type SavedArea } from "@/lib/savedArea";
import { api, getConfig, type Feed, type Listing, type Parsed } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAsync } from "@/lib/useAsync";
import { ListingCard, ListingCardSkeleton } from "@/components/ListingCard";
import { EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";

type TypeFilter = "all" | "house" | "land";
type StatusFilter = "live" | "sold";
const PAGE = 10;

export default function Explore() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("live");
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
    const p = new URLSearchParams({ q, status, limit: String(PAGE), offset: String(offset) });
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
  }, [q, type, status, areaKey]);
  const config = useAsync(getConfig, []);

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

  return (
    <div>
      <header className="sticky top-0 z-30 -mx-4 bg-bg/80 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <Logo />
          <LocationButton area={area} onClear={() => setArea(null)} />
        </div>
        <div className="glass flex h-[52px] min-w-0 items-center gap-3 rounded-full px-5 shadow-card focus-within:border-brand/50">
          <Search size={20} className="shrink-0 text-sub" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search area, budget or type"
            aria-label="Search properties"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sub"
          />
          {input && (
            <button aria-label="Clear search" onClick={() => setInput("")} className="grid h-8 w-8 place-items-center rounded-full text-sub hover:bg-muted">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto">
          {(["all", "house", "land"] as const).map((t) => (
            <Chip key={t} on={type === t} onClick={() => setType(t)}>
              {t === "all" ? "All" : t === "house" ? "Houses" : "Land"}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          <Chip on={status === "live"} onClick={() => setStatus("live")}>
            For sale
          </Chip>
          <Chip on={status === "sold"} onClick={() => setStatus("sold")}>
            Sold
          </Chip>
        </div>
        {data && <ParsedChips parsed={data.parsed} />}
      </header>

      <div className="space-y-4 pt-2">
        {!area && <NearYouCard onArea={setArea} />}
        {!q && !area && status === "live" && type === "all" && <SellBanner />}
        {loading && !data && [0, 1].map((i) => <ListingCardSkeleton key={i} />)}
        {error && <ErrorState message={error.message} retry={reload} />}
        {data && contact && items.map((l) => <ListingCard key={l.id} listing={l} contact={contact} />)}
        {data && !items.length && (
          <EmptyState
            icon={<SearchX size={28} />}
            title={area ? "No properties in this area" : status === "sold" ? "No sold properties yet" : "Nothing matches yet"}
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-10 shrink-0 rounded-full px-4 text-[15px] font-medium transition duration-200 active:scale-95",
        on
          ? "bg-brand-soft text-brand shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_35%,transparent)]"
          : "bg-surface text-sub shadow-[0_0_0_1px_var(--hairline)] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ParsedChips({ parsed }: { parsed: Parsed }) {
  const chips = [
    parsed.max_price && `Under ${inr(parsed.max_price)}`,
    parsed.min_price && `Above ${inr(parsed.min_price)}`,
    parsed.min_cents && `${parsed.min_cents}+ cents`,
    parsed.max_cents && `Up to ${parsed.max_cents} cents`,
    parsed.text && `“${parsed.text}”`,
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-sub">Showing</span>
      {chips.map((c) => (
        <span key={c as string} className="rounded-full bg-surface px-2.5 py-1 font-medium text-ink shadow-[0_0_0_1px_var(--hairline)]">
          {c}
        </span>
      ))}
    </div>
  );
}

function SellBanner() {
  return (
    <Link to="/sell" className="flex items-center gap-4 card p-5 shadow-card transition-colors card-hover">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
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

/** One-time, gentle offer to show properties near the buyer (only useful near the taluk). */
function NearYouCard({ onArea }: { onArea: (a: SavedArea) => void }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (nearMeAsked()) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const done = () => {
    markNearMeAsked();
    setShow(false);
  };

  async function useLocation() {
    setBusy(true);
    try {
      const me = await getMyLocation();
      if (isNearTaluk(me)) {
        onArea({ lat: me.lat.toFixed(5), lng: me.lng.toFixed(5), r: "5", place: "Near you" });
      } else {
        toast("You're outside Chengannur — showing all areas");
      }
    } catch {
      toast("Location not available — showing all areas");
    } finally {
      setBusy(false);
      done();
    }
  }

  return (
    <div className="animate-fade card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <LocateFixed size={20} />
        </span>
        <div>
          <p className="font-semibold">Looking near where you are?</p>
          <p className="text-sm text-sub">Show properties around you.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" disabled={busy} onClick={useLocation}>
          {busy ? "Finding you…" : "Use my location"}
        </Button>
        <Button size="sm" variant="ghost" className="flex-1" onClick={done}>
          No thanks
        </Button>
      </div>
    </div>
  );
}
