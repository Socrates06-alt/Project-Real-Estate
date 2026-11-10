import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { Sheet } from "@/shared/ui/sheet";
import { COUNTRIES, joinPhone, splitPhone } from "@/shared/lib/countries";
import { cn } from "@/shared/lib/utils";
import { Field } from "@/shared/ui/field";

type Props = {
  /** Form field name: a hidden input carries the full number, e.g. "+971501234567". */
  name?: string;
  defaultValue?: string;
  /** Controlled use (no form field): the full number on every change. */
  value?: string;
  onChange?: (full: string) => void;
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  autoComplete?: string;
};

/** Phone number with a country code picker (India by default). */
export function PhoneInput({ name, defaultValue, value, onChange, required, placeholder, autoComplete, ...rest }: Props) {
  const start = splitPhone(value ?? defaultValue);
  const [iso, setIso] = useState(start.iso);
  const [number, setNumber] = useState(start.number);
  const [picking, setPicking] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const country = COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];

  function update(nextIso: string, nextNumber: string) {
    setIso(nextIso);
    setNumber(nextNumber);
    const full = joinPhone(nextIso, nextNumber);
    if (hidden.current) hidden.current.value = full; // right away, so a form reading the field on this event sees it
    onChange?.(full);
  }

  return (
    <div className="flex h-12 w-full items-center rounded-[18px] border border-transparent bg-muted text-[15px] transition duration-200 focus-within:border-brand/40 focus-within:bg-surface focus-within:ring-4 focus-within:ring-brand/12">
      <input
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => update(iso, e.target.value)}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder ?? (iso === "IN" ? "10-digit mobile number" : "Phone number")}
        aria-label={rest["aria-label"]}
        className={cn("h-full min-w-0 flex-1 bg-transparent px-3 text-ink outline-none placeholder:text-sub/70")}
      />
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-label={`Country code +${country.dial}, change`}
        className="order-first flex h-full shrink-0 items-center gap-1 border-r border-line pr-2 pl-3 font-medium"
      >
        +{country.dial}
        <ChevronDown size={14} className="text-sub" />
      </button>
      {picking &&
        createPortal(
          <CountryPicker
            onPick={(c) => {
              update(c, number);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />,
          document.body,
        )}
      {name && <input ref={hidden} type="hidden" name={name} value={joinPhone(iso, number)} readOnly />}
    </div>
  );
}

/** Optional second number, hidden behind a small link until needed. */
export function ExtraPhone({ defaultValue }: { defaultValue?: string }) {
  const [open, setOpen] = useState(Boolean(defaultValue));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="px-1 text-sm font-semibold text-brand">
        + Add another number
      </button>
    );
  return (
    <Field label="Another number (optional)">
      <PhoneInput name="seller_phone2" defaultValue={defaultValue} />
    </Field>
  );
}

/** Searchable list of countries: type a name or a code ("971"). */
function CountryPicker({ onPick, onClose }: { onPick: (iso: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase().replace(/^\+/, "");
  const list = term
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(term) || c.dial.startsWith(term) || c.iso.toLowerCase() === term)
    : COUNTRIES;
  return (
    <Sheet open onClose={onClose} title="Country code">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sub" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search country or code"
          aria-label="Search country or code"
          className="h-12 w-full rounded-[18px] bg-muted pr-4 pl-11 text-[15px] outline-none focus:ring-4 focus:ring-brand/12"
        />
      </div>
      <ul className="mt-3 max-h-[55vh] overflow-y-auto">
        {list.map((c) => (
          <li key={c.iso}>
            <button type="button" onClick={() => onPick(c.iso)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-muted">
              <img src={c.flag} alt="" loading="lazy" className="h-[18px] w-6 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_var(--hairline)]" />
              <span className="flex-1">{c.name}</span>
              <span className="text-sub">+{c.dial}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="px-2 py-6 text-center text-sm text-sub">No country found</li>}
      </ul>
    </Sheet>
  );
}
