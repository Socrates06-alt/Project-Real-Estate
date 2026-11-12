import { t } from "@/shared/i18n";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

export type SizeUnit = "cents" | "acres";
const CENTS_PER_ACRE = 100;
const UNIT_KEY = { cents: "unit.cents", acres: "unit.acres" } as const;

const tidy = (n: number) => String(Number(n.toFixed(4)));

/** Cents from what's typed in the given unit (null when empty or not a number). */
export function toCents(text: string, unit: SizeUnit): number | null {
  const v = Number(text);
  if (!text.trim() || !Number.isFinite(v) || v <= 0) return null;
  return Number((unit === "acres" ? v * CENTS_PER_ACRE : v).toFixed(2));
}

/** Small "cents | acres" switch. */
export function UnitSwitch({ unit, onChange }: { unit: SizeUnit; onChange: (u: SizeUnit) => void }) {
  return (
    <div role="group" aria-label={t("form.unit")} className="flex shrink-0 rounded-full bg-surface p-0.5 text-xs font-semibold shadow-[0_0_0_1px_var(--hairline)]">
      {(["cents", "acres"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => onChange(u)}
          className={cn("rounded-full px-2.5 py-1 transition-colors", unit === u ? "bg-brand text-brand-ink" : "text-sub")}
        >
          {t(UNIT_KEY[u])}
        </button>
      ))}
    </div>
  );
}

type Props = {
  /** Form field name: a hidden input carries the size in cents (what the server stores). */
  name?: string;
  defaultCents?: number | string;
  /** Shared unit (e.g. a from–to pair); without it the box has its own switch. */
  unit?: SizeUnit;
  onCents?: (cents: number | null) => void;
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  /** Show "= 1.5 acres" under the box. */
  hint?: boolean;
  className?: string;
};

/** Land size typed in cents or acres; always sent as cents (1 acre = 100 cents). */
export function SizeInput({ name, defaultCents, unit: sharedUnit, onCents, required, placeholder, hint = true, className, ...rest }: Props) {
  const start = Number(defaultCents) || 0;
  const [ownUnit, setOwnUnit] = useState<SizeUnit>(start >= CENTS_PER_ACRE && start % 10 === 0 ? "acres" : "cents");
  const unit = sharedUnit ?? ownUnit;
  const [text, setText] = useState(start ? tidy(unit === "acres" ? start / CENTS_PER_ACRE : start) : "");
  const unitRef = useRef(unit);
  const input = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  // Switching unit keeps the same size: 150 cents ⇄ 1.5 acres.
  useEffect(() => {
    if (unitRef.current === unit) return;
    const c = toCents(text, unitRef.current);
    unitRef.current = unit;
    if (c != null) setText(tidy(unit === "acres" ? c / CENTS_PER_ACRE : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // Update the hidden cents field before the form hears about the typing (the price box reads it then).
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const sync = () => {
      if (hidden.current) hidden.current.value = String(toCents(el.value, unitRef.current) ?? "");
    };
    el.addEventListener("input", sync);
    return () => el.removeEventListener("input", sync);
  }, []);

  const cents = toCents(text, unit);
  return (
    <div className={className}>
      <div className="flex h-12 w-full items-center gap-2 rounded-[18px] border border-transparent bg-muted pr-1.5 text-[15px] transition duration-200 focus-within:border-brand/40 focus-within:bg-surface focus-within:ring-4 focus-within:ring-brand/12">
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onCents?.(toCents(e.target.value, unit));
          }}
          inputMode="decimal"
          pattern="\d+(\.\d{1,4})?"
          required={required}
          placeholder={placeholder}
          aria-label={rest["aria-label"]}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-ink outline-none placeholder:text-sub/70"
        />
        {sharedUnit ? <span className="pr-2.5 text-sm text-sub">{t(UNIT_KEY[unit])}</span> : <UnitSwitch unit={unit} onChange={setOwnUnit} />}
      </div>
      {name && <input ref={hidden} type="hidden" name={name} value={cents ?? ""} readOnly />}
      {hint && cents != null && (unit === "acres" || cents >= CENTS_PER_ACRE) && (
        <p className="mt-1 px-1 text-xs text-sub">= {unit === "acres" ? `${tidy(cents)} ${t("unit.cents")}` : `${tidy(cents / CENTS_PER_ACRE)} ${t("unit.acres")}`}</p>
      )}
    </div>
  );
}
