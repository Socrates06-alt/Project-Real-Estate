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

/**
 * Place suggestions as you type (free, OpenStreetMap data).
 * Photon matches partial words ("Puliy" → Puliyoor) and is biased to Chengannur;
 * Nominatim (whole words) is the backup.
 */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  try {
    const found = await searchPhoton(q, signal);
    if (found.length) return found;
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  return searchNominatim(q, signal);
}

async function searchPhoton(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({
    q,
    lat: String(CHENGANNUR.lat),
    lon: String(CHENGANNUR.lng),
    limit: "8",
    lang: "en",
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  type Feature = {
    geometry: { coordinates: [number, number] };
    properties: { name?: string; city?: string; district?: string; county?: string; state?: string; countrycode?: string };
  };
  const data: { features: Feature[] } = await res.json();
  return data.features
    .filter((f) => f.properties.countrycode === "IN" && f.properties.name)
    .slice(0, 6)
    .map((f) => ({
      name: f.properties.name!,
      detail: [f.properties.city ?? f.properties.district, f.properties.county, f.properties.state]
        .filter((x, i, all) => x && x !== f.properties.name && all.indexOf(x) === i)
        .slice(0, 2)
        .join(", "),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
}

async function searchNominatim(q: string, signal?: AbortSignal): Promise<Place[]> {
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

/** Straight-line distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Most buyers aren't local (NRIs, other cities): "near you" only makes sense close to the taluk. */
export const NEAR_TALUK_KM = 25;
export const isNearTaluk = (p: LatLng) => distanceKm(p, CHENGANNUR) <= NEAR_TALUK_KM;
