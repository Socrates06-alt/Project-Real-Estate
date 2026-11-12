import { t } from "@/shared/i18n";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api, type PropertyType } from "@/shared/api/client";
import { useSubmit } from "@/shared/lib/useSubmit";
import { QuickContact } from "@/shared/components/QuickContact";
import { cameFrom } from "@/shared/lib/source";
import { AffixInput, Field, Input } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Button, buttonVariants } from "@/shared/ui/button";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormCard } from "@/shared/components/form/FormCard";
import { ExtraPhone, PhoneInput } from "@/shared/components/form/PhoneInput";
import { AreaInput, type Area } from "@/shared/components/AreaInput";
import { EXAMPLES } from "@/shared/lib/examples";
import { AssistanceOption } from "@/shared/components/form/AssistanceOption";
import { FINANCE_HELP } from "@/shared/lib/assistance";
import { SizeInput, UnitSwitch, type SizeUnit } from "@/shared/components/form/SizeInput";

const num = (v: FormDataEntryValue | null) => (v && Number(v) > 0 ? Number(v) : null);

/** A buyer tells us what they're looking for; we call them when something fits. */
export default function RequestProperty() {
  const [type, setType] = useState<PropertyType>("land");
  const [area, setArea] = useState<Area>({ name: "", lat: null, lng: null });
  const [finance, setFinance] = useState(false);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("cents");
  const { sending: busy, done: sent, error, send } = useSubmit();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await send(() =>
      api("/api/buyer-requests", {
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
          wants_finance_help: finance,
          came_from: cameFrom(),
        },
      }),
    );
    window.scrollTo({ top: 0 });
  }

  if (sent)
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold">{t("common.thanks")}</h1>
        <p className="mt-2 max-w-xs text-sub">{t("request.subtitle")}</p>
        <Link to="/" className={`${buttonVariants({ variant: "soft", size: "lg" })} mt-8 max-w-sm`}>
          {t("request.seeProperties")}
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader title={t("request.title")} subtitle={t("request.subtitle")} />
      <QuickContact want="buy" label={t("common.notFillForm")} className="card-sm p-3" />

      <FormCard title={t("request.lookingFor")}>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "land", label: t("type.land") },
            { value: "house", label: t("type.house") },
            { value: "commercial", label: t("type.commercial") },
          ]}
        />
        <Field label={t("request.place")}>
          <AreaInput name="area" value={area} onChange={setArea} placeholder={t("request.anyPlace")} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-sm font-medium">{t("common.landSize")}</span>
            <UnitSwitch unit={sizeUnit} onChange={setSizeUnit} />
          </div>
          <div className="flex items-center gap-2">
            <SizeInput name="min_cents" unit={sizeUnit} hint={false} className="min-w-0 flex-1" placeholder={sizeUnit === "acres" ? "1" : "5"} aria-label={t("request.sizeFrom")} />
            <span className="text-sub">–</span>
            <SizeInput name="max_cents" unit={sizeUnit} hint={false} className="min-w-0 flex-1" placeholder={sizeUnit === "acres" ? "2" : "10"} aria-label={t("request.sizeTo")} />
          </div>
        </div>
        {type === "house" && (
          <Field label={t("request.houseSize")}>
            <AffixInput name="sqft" suffix={t("unit.sqft")} inputMode="numeric" placeholder="1200" pattern="\d+" />
          </Field>
        )}
        <Field label={t("common.budget")}>
          <AffixInput name="budget_lakh" prefix="₹" suffix={t("unit.lakh")} inputMode="decimal" placeholder={EXAMPLES[type].budget} pattern="\d+(\.\d{1,2})?" />
        </Field>
        <Field label={t("request.anythingElse")}>
          <Input name="note" maxLength={500} placeholder={EXAMPLES[type].wants} />
        </Field>
      </FormCard>

      <FormCard title={t("request.help")}>
        <AssistanceOption info={FINANCE_HELP} checked={finance} onChange={setFinance} />
      </FormCard>

      <FormCard title={t("common.yourDetails")}>
        <Field label={t("common.name")}>
          <Input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder={t("common.fullName")} />
        </Field>
        <Field label={t("common.phone")}>
          <PhoneInput name="phone" required autoComplete="tel" />
        </Field>
        <ExtraPhone name="phone2" />
      </FormCard>

      {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm font-medium text-sold">{error}</p>}
      <Button type="submit" variant="accent" size="lg" disabled={busy}>
        {busy ? t("common.sending") : t("request.submit")}
      </Button>
    </form>
  );
}
