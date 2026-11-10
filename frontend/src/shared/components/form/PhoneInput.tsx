import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES, joinPhone, splitPhone } from "@/shared/lib/countries";
import { cn } from "@/shared/lib/utils";

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
      <div className="relative flex h-full shrink-0 items-center border-r border-line pr-1 pl-3">
        <span className="pointer-events-none flex items-center gap-1 font-medium">
          <span aria-hidden>{country.flag}</span>+{country.dial}
          <ChevronDown size={14} className="text-sub" />
        </span>
        <select
          aria-label="Country code"
          value={iso}
          onChange={(e) => update(e.target.value, number)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.flag} {c.name} +{c.dial}
            </option>
          ))}
        </select>
      </div>
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
      {name && <input ref={hidden} type="hidden" name={name} value={joinPhone(iso, number)} readOnly />}
    </div>
  );
}
