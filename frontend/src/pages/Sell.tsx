import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, FileCheck2, ImagePlus, Info, MessageCircle, X } from "lucide-react";
import { api, ApiError, getConfig, type PropertyType } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { AffixInput, Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { AreaInput, type Area } from "@/components/AreaInput";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { waLink } from "@/components/contact";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export default function Sell() {
  const { data: config } = useAsync(getConfig, []);
  const toast = useToast();
  const [type, setType] = useState<PropertyType>("house");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [negotiable, setNegotiable] = useState(true);
  const [docs, setDocs] = useState(false);
  const [docHelp, setDocHelp] = useState(false);
  const [docHelpInfo, setDocHelpInfo] = useState(false);
  const [agree, setAgree] = useState(false);
  const [area, setArea] = useState<Area>({ name: "", lat: null, lng: null });
  const [termsOpen, setTermsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const max = config?.max_photos ?? 3;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const limit = config?.max_photo_bytes ?? 8 * 1024 * 1024;
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= max) break;
      if (!ACCEPT.includes(file.type)) {
        toast("Use JPEG, PNG or WebP photos");
        continue;
      }
      if (file.size > limit) {
        toast("Each photo must be under 8 MB");
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
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
    f.set("consent", "true");
    if (area.lat != null && area.lng != null) {
      f.set("area_lat", String(area.lat));
      f.set("area_lng", String(area.lng));
    }
    f.set("consent_version", config.consent_version);
    f.set("expected_price", String(f.get("expected_price")).replace(/\D/g, ""));
    photos.forEach((p) => f.append("photos", p.file));
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ number: number }>("/api/submissions", { form: f, device: true });
      setNumber(res.number);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (number) return <Done contactWa={config ? waLink(config.contact) : undefined} />;

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader title="List your property" subtitle="Free listing · pay only when it sells" />

      <Card title="Photos" hint={`${photos.length}/${max}`}>
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-2xl">
              <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos(photos.filter((x) => x !== p))}
                className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {photos.length < max && (
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-sub transition hover:border-brand hover:text-brand"
            >
              {photos.length ? <ImagePlus size={22} /> : <Camera size={22} />}
              <span className="text-xs font-semibold">Add photo</span>
            </button>
          )}
        </div>
        <input ref={picker} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))} />
        <p className="mt-2 text-xs text-sub">Up to {max} clear photos.</p>
      </Card>

      <Card title="Property">
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
        <Field label="Location">
          <AreaInput name="location" required value={area} onChange={setArea} />
        </Field>
        <Field label="Full address">
          <Textarea name="address" maxLength={300} rows={2} className="min-h-0" placeholder="House or building name, street, landmark, PIN" />
        </Field>
        <Field label="Description">
          <Textarea
            name="description"
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
      </Card>

      <Card title="Price & documents">
        <Field label="Expected price">
          <AffixInput name="expected_price" prefix="₹" required inputMode="numeric" placeholder="e.g. 25,00,000" />
        </Field>
        <Switch checked={negotiable} onChange={setNegotiable} label="Price is negotiable" />
        <Switch checked={docs} onChange={setDocs} label="Legal documents available" />
        {docs && <Input name="documents_note" maxLength={500} placeholder="e.g. Title deed, tax receipt, survey plan" />}
        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={docHelp}
            aria-label="I need documentation assistance"
            onClick={() => setDocHelp(!docHelp)}
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition",
              docHelp ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface",
            )}
          >
            {docHelp && <Check size={15} strokeWidth={3} />}
          </button>
          <button type="button" onClick={() => setDocHelp(!docHelp)} className="min-w-0 flex-1 text-left">
            <span className="block text-[15px] font-medium">I need documentation assistance</span>
            <span className="block text-xs text-sub">Special charges apply</span>
          </button>
          <button
            type="button"
            aria-label="What's included"
            onClick={() => setDocHelpInfo(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
          >
            <Info size={18} />
          </button>
        </div>
      </Card>

      <Card title="Your details">
        <Field label="Name">
          <Input name="seller_name" required minLength={2} maxLength={80} autoComplete="name" />
        </Field>
        <Field label="Phone">
          <Input name="seller_phone" required inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" />
        </Field>
      </Card>

      <div className="flex items-center gap-3 card-sm p-3.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={agree}
          aria-label="I agree to the brokerage terms"
          onClick={() => setAgree(!agree)}
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition",
            agree ? "border-brand bg-brand text-brand-ink" : "border-line",
          )}
        >
          {agree && <Check size={15} strokeWidth={3} />}
        </button>
        <p className="text-[15px]">
          I agree to the{" "}
          <button type="button" onClick={() => setTermsOpen(true)} className="font-semibold text-brand underline underline-offset-2">
            brokerage terms
          </button>
        </p>
      </div>

      <Sheet open={docHelpInfo} onClose={() => setDocHelpInfo(false)} title="Documentation assistance">
        <p className="-mt-1 mb-3 text-sm text-sub">We help you prepare and obtain:</p>
        <ul className="divide-y divide-line rounded-2xl bg-muted/60">
          {DOC_HELP.map(([name, what]) => (
            <li key={name} className="flex gap-3 px-4 py-3">
              <FileCheck2 size={18} className="mt-0.5 shrink-0 text-verified" />
              <span>
                <span className="block text-[15px] font-semibold">{name}</span>
                <span className="block text-sm text-sub">{what}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium">Special charges apply for this assistance.</p>
        <Button
          size="lg"
          className="mt-4"
          onClick={() => {
            setDocHelp(true);
            setDocHelpInfo(false);
          }}
        >
          I need this
        </Button>
      </Sheet>

      <Sheet open={termsOpen} onClose={() => setTermsOpen(false)} title="Brokerage terms">
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            Listing is <b>free</b>.
          </li>
          <li>
            Seller brokerage: <b>{config?.brokerage.seller_pct ?? 2}%</b>, only when the sale closes through LandFinder.
          </li>
          <li>Buyers pay {config?.brokerage.buyer_pct ?? 1}% separately.</li>
          <li>We confirm any price change with you before updating the listing.</li>
        </ul>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => {
            setAgree(true);
            setTermsOpen(false);
          }}
        >
          I agree
        </Button>
      </Sheet>

      {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm font-medium text-sold">{error}</p>}
      <Button type="submit" variant="accent" size="lg" disabled={busy || !config}>
        {busy ? "Submitting…" : "Submit property"}
      </Button>
    </form>
  );
}

const DOC_HELP: [string, string][] = [
  ["Sale Agreement & Sale Deed Registration", "Drafting the agreement and registering the sale deed at the Sub-Registrar Office."],
  ["Encumbrance Certificate (EC)", "Shows the property is free of loans, mortgages or legal dues."],
  ["Possession Certificate", "From the Village Office, confirming who holds the property."],
  ["Non-Attachment Certificate", "Confirms the property is not attached by any court or revenue recovery."],
  ["Location Sketch", "Village Office sketch showing the property's location and boundaries."],
];

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5 card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {hint && <span className="text-xs text-sub">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Done({ contactWa }: { contactWa?: string }) {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <Check size={30} strokeWidth={2.5} />
      </div>
      <h1 className="text-2xl font-semibold">Submission received</h1>
      <p className="mt-2 max-w-xs text-sub">We'll call you within 24 hours to confirm the details.</p>
      <div className="mt-8 w-full max-w-sm space-y-2.5">
        {contactWa && (
          <a href={contactWa} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "wa", size: "lg" })}>
            <MessageCircle size={19} /> Message us on WhatsApp
          </a>
        )}
        <Link to="/me" className={buttonVariants({ variant: "soft", size: "lg" })}>
          Track in My listings
        </Link>
      </div>
    </div>
  );
}
