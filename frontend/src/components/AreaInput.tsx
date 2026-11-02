import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { searchPlaces, type Place } from "@/lib/geo";
import { Input } from "./ui/field";

export type Area = { name: string; lat: number | null; lng: number | null };

/**
 * Area box: type a few letters, tap a suggestion (sets the area's centre for map search).
 * Typing without picking still works (no map position; Nilayam can fix it in admin).
 */
export function AreaInput({
  value,
  onChange,
  name,
  required,
  placeholder = "Start typing, e.g. Puliyoor",
}: {
  value: Area;
  onChange: (a: Area) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const picked = useRef(false);

  useEffect(() => {
    const q = value.name.trim();
    if (picked.current || q.length < 2) {
      picked.current = false;
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => searchPlaces(q, ctrl.signal).then(setResults, () => {}), 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [value.name]);

  return (
    <div className="relative">
      <Input
        name={name}
        required={required}
        minLength={2}
        maxLength={120}
        autoComplete="off"
        placeholder={placeholder}
        value={value.name}
        onChange={(e) => {
          onChange({ name: e.target.value, lat: null, lng: null }); // typed text: no position until picked
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          // Keep the suggestions above the bottom bar / phone keyboard.
          const el = e.currentTarget;
          setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {value.lat != null && (
        <MapPin size={17} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-brand" aria-label="Area found on map" />
      )}
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-[52px] z-30 overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
          {results.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  picked.current = true;
                  onChange({ name: p.name, lat: round(p.lat), lng: round(p.lng) });
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

const round = (n: number) => Math.round(n * 1e5) / 1e5;
