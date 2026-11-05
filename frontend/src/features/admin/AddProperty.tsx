import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getConfig, type PropertyType } from "@/shared/api/client";
import { shrinkImage } from "@/shared/lib/image";
import { useAsync } from "@/shared/lib/useAsync";
import { AffixInput, Field, Input, Textarea } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { AreaInput, type Area } from "@/shared/components/AreaInput";
import { FormCard } from "@/shared/components/form/FormCard";
import { Checkbox } from "@/shared/components/form/Checkbox";
import { ACCEPT, PhotoPicker, type PickedPhoto } from "@/shared/components/form/PhotoPicker";
import { useAdmin } from "@/features/admin/auth";

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
  const [agreed, setAgreed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = config?.max_photos ?? 3;

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
    f.set("consent", "true");
    f.set("consent_version", config.consent_version);
    f.set("expected_price", String(f.get("expected_price")).replace(/\D/g, ""));
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
          <p className="text-xs text-sub">For a seller you've spoken to</p>
        </div>
      </header>

      <FormCard title="Seller">
        <Field label="Seller's name">
          <Input name="seller_name" required minLength={2} maxLength={80} placeholder="Full name" />
        </Field>
        <Field label="Seller's phone">
          <Input name="seller_phone" required inputMode="tel" placeholder="10-digit mobile number" />
        </Field>
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
          <AffixInput name="land_area_cents" suffix="cents" required inputMode="decimal" placeholder="e.g. 10" pattern="\d+(\.\d{1,2})?" />
        </Field>
        <Field label="Location" hint={area.lat != null ? "On map search" : "Pick a suggestion to include in map search"}>
          <AreaInput name="location" required value={area} onChange={setArea} />
        </Field>
        <Field label="Full address (private)">
          <Textarea name="address" maxLength={300} rows={2} className="min-h-0" placeholder="House name, street, landmark, PIN" />
        </Field>
        <Field label="Description">
          <Textarea name="description" maxLength={4000} placeholder="Road access, water, bedrooms, nearby places…" />
        </Field>
      </FormCard>

      <FormCard title="Price & documents">
        <Field label="Seller's expected price">
          <AffixInput name="expected_price" prefix="₹" required inputMode="numeric" placeholder="e.g. 25,00,000" />
        </Field>
        <Switch checked={negotiable} onChange={setNegotiable} label="Price is negotiable" />
        <Switch checked={docs} onChange={setDocs} label="Legal documents available" />
        {docs && <Input name="documents_note" maxLength={500} placeholder="e.g. Title deed, tax receipt, survey plan" />}
        <Switch checked={docHelp} onChange={setDocHelp} label="Seller wants documentation assistance" />
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
