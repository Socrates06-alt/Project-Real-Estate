import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getConfig, type PropertyType } from "@/shared/api/client";
import { shrinkImage } from "@/shared/lib/image";
import { useAsync } from "@/shared/lib/useAsync";
import { Field, Input, Textarea } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { AreaInput, type Area } from "@/shared/components/AreaInput";
import { FormCard } from "@/shared/components/form/FormCard";
import { ExpectedPrice, expectedTotal } from "@/shared/components/form/ExpectedPrice";
import { Checkbox } from "@/shared/components/form/Checkbox";
import { ExtraPhone, PhoneInput } from "@/shared/components/form/PhoneInput";
import { AssistanceOption } from "@/shared/components/form/AssistanceOption";
import { DEV_HELP, DOC_HELP } from "@/shared/lib/assistance";
import { ACCEPT, PhotoPicker, type PickedPhoto } from "@/shared/components/form/PhotoPicker";
import { useAdmin } from "@/features/admin/auth";
import { RephraseButton } from "./property/RephraseButton";
import { SizeInput } from "@/shared/components/form/SizeInput";

/**
 * A founder enters a seller's property directly (after a visit or a call).
 * It's saved like a seller's own submission, then opens in the editor to review and publish.
 */
export default function AddProperty() {
  const { call } = useAdmin();
  const nav = useNavigate();
  const toast = useToast();
  const { data: config } = useAsync(getConfig, []);
  const [type, setType] = useState<PropertyType>("land");
  const [area, setArea] = useState<Area>({ name: "", lat: null, lng: null });
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [negotiable, setNegotiable] = useState(true);
  const [docs, setDocs] = useState(false);
  const [docHelp, setDocHelp] = useState(false);
  const [devHelp, setDevHelp] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = config?.max_photos ?? 3;
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    setPreparing(true);
    try {
      for (const original of Array.from(files)) {
        if (next.length >= max) break;
        if (!ACCEPT.includes(original.type)) {
          toast("Use JPEG, PNG or WebP photos");
          continue;
        }
        const file = await shrinkImage(original);
        next.push({ file, url: URL.createObjectURL(file) });
      }
    } finally {
      setPreparing(false);
    }
    setPhotos(next);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config) return;
    if (!agreed) return setError("Confirm the seller agreed to the brokerage terms");
    const f = new FormData(e.currentTarget);
    f.set("property_type", type);
    f.set("negotiable", String(negotiable));
    f.set("documents_available", String(docs));
    f.set("wants_doc_help", String(docHelp));
    f.set("wants_dev_help", String(devHelp));
    f.set("consent", "true");
    f.set("consent_version", config.consent_version);
    f.set("expected_price", String(expectedTotal(f, type)));
    f.delete("price_per_cent");
    if (area.lat != null && area.lng != null) {
      f.set("area_lat", String(area.lat));
      f.set("area_lng", String(area.lng));
    }
    photos.forEach((p) => f.append("photos", p.file));
    setBusy(true);
    setError(null);
    try {
      const res = await call<{ id: string; number: number }>("/properties", { method: "POST", form: f });
      toast(`Added #${res.number}. Review and publish.`);
      nav(`/admin/p/${res.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-8">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => nav(-1)} aria-label="Back" className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Add property</h1>
        </div>
      </header>

      <FormCard title="Seller">
        <Field label="Name">
          <Input name="seller_name" required minLength={2} maxLength={80} />
        </Field>
        <Field label="Phone">
          <PhoneInput name="seller_phone" required placeholder="" />
        </Field>
        <ExtraPhone placeholder="" />
      </FormCard>

      <PhotoPicker photos={photos} max={max} preparing={preparing} onAdd={addPhotos} onRemove={(p) => setPhotos(photos.filter((x) => x !== p))} />

      <FormCard title="Property">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "house", label: "House" },
            { value: "land", label: "Land" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
        <Field label="Land size">
          <SizeInput name="land_area_cents" required />
        </Field>
        <Field label="Location" hint={area.lat != null ? "On map search" : undefined}>
          <AreaInput name="location" required value={area} onChange={setArea} placeholder="" />
        </Field>
        <Field label="Full address (private)">
          <Textarea name="address" maxLength={300} rows={2} className="min-h-0" />
        </Field>
        <Field label="Description">
          <Textarea ref={descRef} name="description" maxLength={4000} />
        </Field>
        <RephraseButton
          get={() => ({ location: area.name, description: descRef.current?.value ?? "" })}
          onDone={(r) => {
            if (descRef.current) descRef.current.value = r.description;
            if (r.location) setArea((a) => ({ ...a, name: r.location }));
          }}
        />
      </FormCard>

      <FormCard title="Price & documents">
        <ExpectedPrice type={type} examples={false} />
        <Switch checked={negotiable} onChange={setNegotiable} label="Negotiable" />
        <Switch checked={docs} onChange={setDocs} label="Legal documents available" />
        <AssistanceOption info={DOC_HELP} checked={docHelp} onChange={setDocHelp} />
        <AssistanceOption info={DEV_HELP} checked={devHelp} onChange={setDevHelp} />
      </FormCard>

      <div className="flex items-start gap-3 card-sm p-3.5">
        <Checkbox checked={agreed} onChange={setAgreed} label="Seller agreed to the brokerage terms" className="border-line" />
        <p className="text-[15px]">
          The seller agreed to the brokerage terms ({config?.brokerage.seller_pct ?? 2}% on sale).
        </p>
      </div>

      {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm font-medium text-sold">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || preparing || !config}>
        {busy ? "Saving…" : "Save property"}
      </Button>
    </form>
  );
}
