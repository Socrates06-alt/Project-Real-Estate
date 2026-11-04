import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/shared/lib/geo";

/** A Leaflet map with free OpenStreetMap tiles. */
export function createMap(el: HTMLElement, center: LatLng, zoom: number, options: L.MapOptions = {}) {
  const map = L.map(el, { zoomControl: false, ...options }).setView(center, zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

/** Round pin used for draggable markers (no image files needed). */
export const pinIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });

export { L };
