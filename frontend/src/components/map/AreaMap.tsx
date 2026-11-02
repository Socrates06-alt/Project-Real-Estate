import { useEffect, useRef } from "react";
import { cssVar } from "@/lib/geo";
import { createMap, L } from "./leaflet";

/** Buyer view: a soft circle around the approximate spot. Never the exact location. */
export function AreaMap({ lat, lng }: { lat: number; lng: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = createMap(el.current, { lat, lng }, 15, { dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, attributionControl: false });
    const brand = cssVar("--brand") || "#3a7fc8";
    const circle = L.circle({ lat, lng }, { radius: 500, color: brand, weight: 2, fillColor: brand, fillOpacity: 0.15, interactive: false }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [12, 12] });
    return () => {
      map.remove();
    };
  }, [lat, lng]);
  return <div ref={el} className="relative z-0 h-48 overflow-hidden rounded-2xl" />;
}
