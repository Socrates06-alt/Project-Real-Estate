export type LatLng = { lat: number; lng: number };

/** Used only if the user's location isn't available. */
export const CHENGANNUR: LatLng = { lat: 9.3176, lng: 76.6113 };

/** The phone's current location (asks permission). Needs https or localhost. */
export function getMyLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export type Place = { name: string; detail: string; lat: number; lng: number };

/** Place search via OpenStreetMap (free). Prefers results around Chengannur, works for all of India. */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "in",
    viewbox: "76.40,9.50,76.85,9.10", // Chengannur area first
    limit: "6",
    "accept-language": "en",
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const rows: { name: string; display_name: string; lat: string; lon: string }[] = await res.json();
  return rows.map((r) => ({
    name: r.name || r.display_name.split(",")[0],
    detail: r.display_name.split(",").slice(1, 3).join(",").trim(),
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
