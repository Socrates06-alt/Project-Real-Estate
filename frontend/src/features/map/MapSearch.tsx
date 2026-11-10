import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, LocateFixed, MapPin, Search, X } from "lucide-react";
import { api, type Feed } from "@/shared/api/client";
import { CHENGANNUR, cssVar, getMyLocation, isNearTaluk, searchPlaces, type LatLng, type Place } from "@/shared/lib/geo";
import { createMap, L } from "@/features/map/leaflet";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";

const MIN_KM = 1;
const MAX_KM = 20;

/**
 * Area search, like Facebook Ads location targeting:
 * a fixed centre pin, a blue radius circle, place search, "Near me" and a radius slider.
 * Opens at the user's own location by default.
 */
export default function MapSearch() {
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const fromUrl = params.get("lat") && params.get("lng") ? { lat: Number(params.get("lat")), lng: Number(params.get("lng")) } : null;

  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [center, setCenter] = useState<LatLng>(fromUrl ?? CHENGANNUR);
  const [radius, setRadius] = useState(() => clamp(Number(params.get("r")) || 5));
  const [place, setPlace] = useState(params.get("place") ?? "");
  const [locating, setLocating] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const map = createMap(el.current, fromUrl ?? CHENGANNUR, 13);
    const brand = cssVar("--brand") || "#2e3a8c";
    const circle = L.circle(map.getCenter(), {
      radius: radius * 1000,
      color: brand,
      weight: 2,
      fillColor: brand,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [24, 24] });
    map.on("move", () => circle.setLatLng(map.getCenter()));
    map.on("moveend", () => setCenter(map.getCenter()));
    map.on("dragstart", () => setPlace("Selected area"));
    mapRef.current = map;
    circleRef.current = circle;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default: the user's own location (unless we came back with an area already chosen).
  useEffect(() => {
    if (!fromUrl) locateMe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function locateMe(initial = false) {
    setLocating(true);
    try {
      const me = await getMyLocation();
      if (isNearTaluk(me)) {
        flyTo(me);
        setPlace("Your location");
      } else {
        // Most buyers are away (NRIs, other cities): keep the map on Chengannur.
        if (initial) {
          flyTo(CHENGANNUR);
          setPlace("Chengannur");
        }
        toast("You're outside Chengannur — search a place instead");
      }
    } catch {
      if (initial) {
        flyTo(CHENGANNUR);
        setPlace("Chengannur");
      }
      toast(initial ? "Location is off — showing Chengannur" : "Couldn't get your location");
    } finally {
      setLocating(false);
    }
  }

  function flyTo(p: LatLng) {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    circle.setLatLng(p);
    map.fitBounds(circle.getBounds(), { padding: [24, 24], animate: true });
  }

  // Radius slider: resize the circle and zoom to fit it.
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    circle.setRadius(radius * 1000);
    map.fitBounds(circle.getBounds(), { padding: [24, 24], animate: true });
  }, [radius]);

  // How many properties are inside the circle (count only).
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ lat: center.lat.toFixed(5), lng: center.lng.toFixed(5), radius_km: String(radius), limit: "1" });
        const feed = await api<Feed>(`/api/listings?${qs}`);
        if (ctrl.signal.aborted) return;
        setCount(feed.total); // only a count: properties are never shown on the map
        setFailed(false);
      } catch {
        if (!ctrl.signal.aborted) {
          setCount(null);
          setFailed(true);
        }
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [center, radius]);

  function showProperties() {
    const qs = new URLSearchParams({
      lat: center.lat.toFixed(5),
      lng: center.lng.toFixed(5),
      r: String(radius),
      place: place || "Selected area",
    });
    nav(`/?${qs}`);
  }

  return (
    <div className="fixed inset-0 bg-bg">
      <div ref={el} className="absolute inset-0" />

      {/* Fixed centre pin: the map moves under it */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full text-brand drop-shadow-md">
        <MapPin size={40} strokeWidth={2.2} fill="var(--surface)" />
      </div>

      {/* Top: back, place search, near me */}
      <div className="absolute inset-x-0 top-0 z-[1000] px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-xl items-start gap-2">
          <button onClick={() => nav(-1)} aria-label="Back" className="glass grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full shadow-card">
            <ChevronLeft size={22} />
          </button>
          <PlaceSearch
            onPick={(p) => {
              flyTo(p);
              setPlace(p.name);
            }}
          />
          <button
            onClick={() => locateMe()}
            disabled={locating}
            aria-label="Near me"
            className="glass flex h-[52px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-brand shadow-card"
          >
            <LocateFixed size={19} className={cn(locating && "animate-pulse")} />
            <span className="hidden sm:inline">Near me</span>
          </button>
        </div>
      </div>

      {/* Bottom: radius + show button */}
      <div className="absolute inset-x-0 bottom-0 z-[1000] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass mx-auto max-w-xl rounded-3xl p-4 shadow-float">
          <div className="flex items-baseline justify-between">
            <p className="truncate text-sm text-sub">
              <MapPin size={14} className="mr-1 inline align-[-2px]" />
              {locating ? "Finding your location…" : place || "Selected area"}
            </p>
            <p className="shrink-0 text-lg font-semibold">{radius} km</p>
          </div>
          <input
            type="range"
            min={MIN_KM}
            max={MAX_KM}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label="Search radius in kilometres"
            className="mt-3 h-2 w-full cursor-pointer accent-[var(--brand)]"
          />
          <div className="mt-1 flex justify-between text-xs text-sub">
            <span>{MIN_KM} km</span>
            <span>{MAX_KM} km</span>
          </div>
          <Button size="lg" className="mt-3 h-[52px] rounded-full" disabled={!count} onClick={showProperties}>
            {failed ? "Couldn't search — try again shortly" : count == null ? "Searching…" : count === 0 ? "No properties in this area" : `Show ${count} propert${count === 1 ? "y" : "ies"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function clamp(km: number) {
  return Math.min(MAX_KM, Math.max(MIN_KM, Math.round(km)));
}

function PlaceSearch({ onPick }: { onPick: (p: Place) => void }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal).then(setResults, () => {});
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [text]);

  return (
    <div className="relative min-w-0 flex-1">
      <div className="glass flex h-[52px] items-center gap-2.5 rounded-full px-4 shadow-card">
        <Search size={19} className="shrink-0 text-sub" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search a place"
          aria-label="Search a place"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sub"
        />
        {text && (
          <button aria-label="Clear" onClick={() => (setText(""), setResults([]))} className="grid h-7 w-7 place-items-center rounded-full text-sub">
            <X size={15} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-[58px] overflow-hidden card shadow-float">
          {results.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button
                onClick={() => {
                  onPick(p);
                  setText(p.name);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted"
              >
                <MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-sm text-sub">{p.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
