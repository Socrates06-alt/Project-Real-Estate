import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { ApiError, api, type PropertyType } from "@/shared/api/client";
import { AffixInput, Field, Input } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Button, buttonVariants } from "@/shared/ui/button";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormCard } from "@/shared/components/form/FormCard";
import { ExtraPhone, PhoneInput } from "@/shared/components/form/PhoneInput";
import { AreaInput, type Area } from "@/shared/components/AreaInput";
import { EXAMPLES } from "@/shared/lib/examples";
import { REQUEST_LABEL } from "@/shared/lib/labels";

const num = (v: FormDataEntryValue | null) => (v && Number(v) > 0 ? Number(v) : null);

/** A buyer tells us what they're looking for; we call them when something fits. */
export default function RequestProperty() {
  const [type, setType] = useState<PropertyType>("land");
  const [area, setArea] = useState<Area>({ name: "", lat: null, lng: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/buyer-requests", {
        body: {
          name: f.get("name"),
          phones: [f.get("phone"), f.get("phone2")].filter(Boolean),
          property_type: type,
          area: area.name,
          min_cents: num(f.get("min_cents")),
          max_cents: num(f.get("max_cents")),
          budget_lakh: num(f.get("budget_lakh")),
          sqft: type === "house" ? num(f.get("sqft")) : null,
          note: f.get("note") ?? "",
        },
      });
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold">Thanks!</h1>
        <p className="mt-2 max-w-xs text-sub">We'll call you when we find a match.</p>
        <Link to="/" className={`${buttonVariants({ variant: "soft", size: "lg" })} mt-8 max-w-sm`}>
          See properties
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader title={REQUEST_LABEL} subtitle="Tell us what you need. We'll call you." />

      <FormCard title="Looking for">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "land", label: "Land" },
            { value: "house", label: "House" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
        <Field label="Area">
          <AreaInput name="area" value={area} onChange={setArea} />
        </Field>
        <Field label="Land size">
          <div className="flex items-center gap-2">
            <AffixInput name="min_cents" suffix="cents" inputMode="decimal" placeholder="5" pattern="\d+(\.\d{1,2})?" aria-label="Land size from" />
            <span className="text-sub">–</span>
            <AffixInput name="max_cents" suffix="cents" inputMode="decimal" placeholder="10" pattern="\d+(\.\d{1,2})?" aria-label="Land size to" />
          </div>
        </Field>
        {type === "house" && (
          <Field label="House size">
            <AffixInput name="sqft" suffix="sq ft" inputMode="numeric" placeholder="1200" pattern="\d+" />
          </Field>
        )}
        <Field label="Budget">
          <AffixInput name="budget_lakh" prefix="₹" suffix="lakh" inputMode="decimal" placeholder={EXAMPLES[type].budget} pattern="\d+(\.\d{1,2})?" />
        </Field>
        <Field label="Anything else">
          <Input name="note" maxLength={500} placeholder={EXAMPLES[type].wants} />
        </Field>
      </FormCard>

      <FormCard title="Your details">
        <Field label="Name">
          <Input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Full name" />
        </Field>
        <Field label="Phone">
          <PhoneInput name="phone" required autoComplete="tel" />
        </Field>
        <ExtraPhone name="phone2" />
      </FormCard>

      {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm font-medium text-sold">{error}</p>}
      <Button type="submit" variant="accent" size="lg" disabled={busy}>
        {busy ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
