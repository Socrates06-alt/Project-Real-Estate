import { useEffect, useRef, useState } from "react";
import type { PropertyType } from "@/shared/api/client";
import { inr } from "@/shared/lib/format";
import { EXAMPLES } from "@/shared/lib/examples";
import { AffixInput, Field } from "@/shared/ui/field";

const digits = (v: string) => v.replace(/\D/g, "");
const indian = (v: string) => (digits(v) ? Number(digits(v)).toLocaleString("en-IN") : "");

/**
 * Expected price. Land is priced per cent (how it's quoted locally), with the total shown as you type;
 * other types take the total. Reads the land size from the same form's "land_area_cents" field.
 * The form sends "price_per_cent" for land; use expectedTotal() when submitting.
 */
export function ExpectedPrice(props: { type: PropertyType; defaultTotal?: number; defaultPerCent?: string; label?: string; examples?: boolean }) {
  const { type, defaultTotal, defaultPerCent, label = "Expected price", examples = true } = props;
  const box = useRef<HTMLDivElement>(null);
  const [cents, setCents] = useState(0);
  const [perCent, setPerCent] = useState(defaultPerCent ? digits(defaultPerCent) : "");

  // Follow the land size typed elsewhere in the form.
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const read = () => setCents(Number((form.elements.namedItem("land_area_cents") as HTMLInputElement | null)?.value) || 0);
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, []);

  // Editing an existing price: start from the total divided by the size.
  useEffect(() => {
    if (type === "land" && defaultTotal && cents && !perCent) setPerCent(String(Math.round(defaultTotal / cents)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, defaultTotal, cents]);

  const total = Math.round((Number(digits(perCent)) || 0) * cents);
  return (
    <div ref={box}>
      {type === "land" ? (
        <>
          <Field label={`${label} per cent`}>
            <AffixInput name="price_per_cent" value={indian(perCent)} onChange={(e) => setPerCent(digits(e.target.value))} prefix="₹" suffix="/ cent" required inputMode="numeric" placeholder={examples ? EXAMPLES.land.price : undefined} />
          </Field>
          {total > 0 && <p className="mt-1.5 px-1 text-sm text-sub">Total {inr(total)} for {cents} cents</p>}
        </>
      ) : (
        <Field label={label}>
          <AffixInput name="expected_price" defaultValue={defaultTotal ? indian(String(defaultTotal)) : undefined} prefix="₹" required inputMode="numeric" placeholder={examples ? EXAMPLES[type].price : undefined} />
        </Field>
      )}
    </div>
  );
}

/** Total expected price from a submitted form: per cent × cents for land, the typed total otherwise. */
export function expectedTotal(f: FormData, type: PropertyType): number {
  if (type === "land") {
    const perCent = Number(digits(String(f.get("price_per_cent") ?? "")));
    return Math.round(perCent * (Number(f.get("land_area_cents")) || 0));
  }
  return Number(digits(String(f.get("expected_price") ?? "")));
}
