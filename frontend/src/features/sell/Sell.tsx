import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, getConfig, uploadForm, type PropertyType } from "@/shared/api/client";
import { shrinkImage } from "@/shared/lib/image";
import { useAsync } from "@/shared/lib/useAsync";
import { AffixInput, Field, Input, Textarea } from "@/shared/ui/field";
import { AreaInput, type Area } from "@/shared/components/AreaInput";
import { PageHeader } from "@/shared/components/PageHeader";
import { Segmented } from "@/shared/ui/segmented";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { waLink } from "@/shared/components/contact";
import { useSellDraft } from "./useSellDraft";
import { FormCard } from "@/shared/components/form/FormCard";
import { ExpectedPrice, expectedTotal } from "@/shared/components/form/ExpectedPrice";
import { ACCEPT, PhotoPicker, type PickedPhoto } from "@/shared/components/form/PhotoPicker";
import { PhoneInput } from "@/shared/components/form/PhoneInput";
import { AssistanceOption } from "@/shared/components/form/AssistanceOption";
import { DEV_HELP, DOC_HELP } from "@/shared/lib/assistance";
import { BrokerageConsent } from "./BrokerageConsent";
import { UploadProgress } from "./UploadProgress";
import { SubmitDone } from "./SubmitDone";

// Typed fields remembered in the draft (the consent tick is never remembered).
const TEXT_FIELDS = ["land_area_cents", "address", "description", "expected_price", "price_per_cent", "seller_name", "seller_phone", "seller_phone2"];
const NO_AREA: Area = { name: "", lat: null, lng: null };

/** "List your property": the seller's form. Photos are shrunk on the phone; the form is remembered if left unfinished. */
export default function Sell() {
  const { data: config } = useAsync(getConfig, []);
  const toast = useToast();
  const [type, setType] = useState<PropertyType>("house");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [negotiable, setNegotiable] = useState(true);
  const [docs, setDocs] = useState(false);
  const [docHelp, setDocHelp] = useState(false);
  const [devHelp, setDevHelp] = useState(false);
  const [agree, setAgree] = useState(false);
  const [area, setArea] = useState<Area>(NO_AREA);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false); // shrinking photos on the phone
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const max = config?.max_photos ?? 3;

  const draft = useSellDraft({
    formRef,
    textFields: TEXT_FIELDS,
    state: { type, negotiable, docs, docHelp, devHelp, area },
    photos,
    disabled: number != null,
    onRestore: (d) => {
      const st = d.state as { type?: PropertyType; negotiable?: boolean; docs?: boolean; docHelp?: boolean; devHelp?: boolean; area?: Area };
      if (st.type) setType(st.type);
      if (st.negotiable != null) setNegotiable(st.negotiable);
      if (st.docs != null) setDocs(st.docs);
      if (st.docHelp != null) setDocHelp(st.docHelp);
      if (st.devHelp != null) setDevHelp(st.devHelp);
      if (st.area) setArea(st.area);
      setPhotos(
        d.photos.map((b, i) => {
          const file = new File([b], `photo-${i + 1}.jpg`, { type: b.type || "image/jpeg" });
          return { file, url: URL.createObjectURL(file) };
        }),
      );
    },
  });
  const saved = draft.saved;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  async function startOver() {
    await draft.startOver(() => {
      setType("house");
      setNegotiable(true);
      setDocs(false);
      setDocHelp(false);
      setDevHelp(false);
      setArea(NO_AREA);
      setPhotos([]);
      setAgree(false);
    });
    window.scrollTo({ top: 0 });
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const limit = config?.max_photo_bytes ?? 8 * 1024 * 1024;
    const next = [...photos];
    setPreparing(true);
    try {
      for (const original of Array.from(files)) {
        if (next.length >= max) break;
        if (!ACCEPT.includes(original.type)) {
          toast("Use JPEG, PNG or WebP photos");
          continue;
        }
        const file = await shrinkImage(original); // checked after shrinking: big camera photos are fine
        if (file.size > limit) {
          toast("This photo is too large. Please choose another.");
          continue;
        }
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
    if (!agree) return setError("Please accept the brokerage terms");
    const f = new FormData(e.currentTarget);
    f.set("property_type", type);
    f.set("negotiable", String(negotiable));
    f.set("documents_available", String(docs));
    f.set("wants_doc_help", String(docHelp));
    f.set("wants_dev_help", String(devHelp));
    f.set("consent", "true");
    if (area.lat != null && area.lng != null) {
      f.set("area_lat", String(area.lat));
      f.set("area_lng", String(area.lng));
    }
    f.set("consent_version", config.consent_version);
    f.set("expected_price", String(expectedTotal(f, type)));
    f.delete("price_per_cent");
    photos.forEach((p) => f.append("photos", p.file));
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const res = await uploadForm<{ number: number }>("/api/submissions", f, setProgress, { device: true });
      await draft.discard();
      setNumber(res.number);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (number) return <SubmitDone contactWa={config ? waLink(config.contact) : undefined} />;

  return (
    <form key={draft.formKey} ref={formRef} onSubmit={submit} onInput={draft.onTyping} className="space-y-4">
      <PageHeader title="List your property" subtitle="Free listing · pay only when it sells" />
      {draft.restored && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand">
          <span>Continuing your unfinished listing</span>
          <button type="button" onClick={startOver} className="shrink-0 font-semibold underline underline-offset-2">
            Start over
          </button>
        </div>
      )}

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
          <AffixInput name="land_area_cents" defaultValue={saved.land_area_cents} suffix="cents" required inputMode="decimal" placeholder="e.g. 10" pattern="\d+(\.\d{1,2})?" />
        </Field>
        <Field label="Location">
          <AreaInput name="location" required value={area} onChange={setArea} />
        </Field>
        <Field label="Full address">
          <Textarea name="address" defaultValue={saved.address} maxLength={300} rows={2} className="min-h-0" placeholder="House or building name, street, landmark, PIN" />
        </Field>
        <Field label="Description">
          <Textarea
            name="description"
            defaultValue={saved.description}
            maxLength={4000}
            placeholder={
              type === "house"
                ? "Bedrooms, built-up area, road access, water…"
                : type === "commercial"
                  ? "Floor area, frontage, parking, road access…"
                  : "Road access, shape of plot, trees, water…"
            }
          />
        </Field>
      </FormCard>

      <FormCard title="Price & documents">
        <ExpectedPrice type={type} defaultTotal={Number(saved.expected_price?.replace(/\D/g, "")) || undefined} defaultPerCent={saved.price_per_cent} />
        <Switch checked={negotiable} onChange={setNegotiable} label="Negotiable" />
        <Switch checked={docs} onChange={setDocs} label="Legal documents available" />
        <AssistanceOption info={DOC_HELP} checked={docHelp} onChange={setDocHelp} />
        <AssistanceOption info={DEV_HELP} checked={devHelp} onChange={setDevHelp} />
      </FormCard>

      <FormCard title="Your details">
        <Field label="Name">
          <Input name="seller_name" defaultValue={saved.seller_name} required minLength={2} maxLength={80} autoComplete="name" placeholder="Your full name" />
        </Field>
        <Field label="Phone">
          <PhoneInput name="seller_phone" defaultValue={saved.seller_phone} required autoComplete="tel" />
        </Field>
        <ExtraPhone defaultValue={saved.seller_phone2} />
      </FormCard>

      <BrokerageConsent agree={agree} onChange={setAgree} config={config} />

      {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm font-medium text-sold">{error}</p>}
      {progress != null && <UploadProgress progress={progress} />}
      <Button type="submit" variant="accent" size="lg" disabled={busy || preparing || !config}>
        {busy ? (progress != null && progress < 100 ? `Uploading ${progress}%` : "Submitting…") : "Submit property"}
      </Button>
    </form>
  );
}

/** Optional second number, hidden behind a small link until needed. */
function ExtraPhone({ defaultValue }: { defaultValue?: string }) {
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
