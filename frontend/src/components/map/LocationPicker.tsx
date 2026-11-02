import { useEffect, useRef } from "react";
import { LocateFixed, Trash2 } from "lucide-react";
import { CHENGANNUR, cssVar, getMyLocation, type LatLng } from "@/lib/geo";
import { useToast } from "@/components/ui/toast";
import { createMap, L, pinIcon } from "./leaflet";

/** Admin: tap the map to drop the exact (private) pin; drag to adjust. */
export function LocationPicker({
  value,
  onChange,
  disabled,
}: {
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!el.current) return;
    const map = createMap(el.current, value ?? CHENGANNUR, value ? 16 : 12, { attributionControl: false });
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!disabled) onChangeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) });
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync with the value.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = L.marker(value, { draggable: !disabled, icon: pinIcon(cssVar("--brand") || "#3a7fc8") }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current({ lat: round(p.lat), lng: round(p.lng) });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(value);
    }
  }, [value, disabled]);

  async function usePhoneLocation() {
    try {
      const me = await getMyLocation();
      const p = { lat: round(me.lat), lng: round(me.lng) };
      onChange(p);
      mapRef.current?.setView(p, 17);
    } catch {
      toast("Couldn't get this phone's location");
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-semibold">Location</p>
        <span className="text-xs text-sub">{value ? "Buyers see only an approximate area" : "Tap the map to place the pin"}</span>
      </div>
      <div ref={el} className="relative z-0 h-56 overflow-hidden rounded-2xl border border-line" />
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={usePhoneLocation} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-surface text-sm font-medium">
            <LocateFixed size={16} className="text-brand" /> I'm at the property
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium text-sub">
              <Trash2 size={15} /> Remove pin
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;
