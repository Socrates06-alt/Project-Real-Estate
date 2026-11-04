/** The buyer's last chosen area, remembered on this phone only. */
export type SavedArea = { lat: string; lng: string; r: string; place: string };

const AREA_KEY = "nilayam.area";
const NEAR_ME_KEY = "nilayam.nearMeAsked";

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

export function loadArea(): SavedArea | null {
  try {
    const a = JSON.parse(get(AREA_KEY) ?? "null");
    return a && a.lat && a.lng ? a : null;
  } catch {
    return null;
  }
}

export const saveArea = (a: SavedArea | null) => set(AREA_KEY, a ? JSON.stringify(a) : null);
export const nearMeAsked = () => get(NEAR_ME_KEY) === "1";
export const markNearMeAsked = () => set(NEAR_ME_KEY, "1");
