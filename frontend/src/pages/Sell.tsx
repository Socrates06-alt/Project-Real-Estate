import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, Copy, ImagePlus, MessageCircle, X } from "lucide-react";
import { api, ApiError, getConfig, type PropertyType } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Field, Input, Textarea } from "@/components/ui/field";
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
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
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
    if (!photos.length) return setError("Add at least one photo");
    if (!agree) return setError("Please accept the brokerage terms");
    const f = new FormData(e.currentTarget);
    f.set("property_type", type);
    f.set("negotiable", String(negotiable));
    f.set("documents_available", String(docs));
    f.set("consent", "true");
    f.set("consent_version", config.consent_version);
    f.set("expected_price", String(f.get("expected_price")).replace(/\D/g, ""));
    photos.forEach((p) => f.append("photos", p.file));
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ref_code: string }>("/api/submissions", { form: f, device: true });
      setRefCode(res.ref_code);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (refCode) return <Done refCode={refCode} contactWa={config ? waLink(config.contact) : undefined} />;

  return (
    <form onSubmit={submit} className="space-y-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="px-1 pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">List your property</h1>
        <p className="text-sub">Free listing · takes about two minutes · we call to confirm.</p>
      </header>

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
        <p className="mt-2 text-xs text-sub">Up to {max} clear photos. Location data in photos is removed automatically.</p>
      </Card>

      <Card title="Property">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "house", label: "🏠  House" },
            { value: "land", label: "🌿  Land" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area" hint="cents">
            <Input name="land_area_cents" required inputMode="decimal" placeholder="10" pattern="\d+(\.\d{1,2})?" />
          </Field>
          <Field label="Location">
            <Input name="location" required minLength={2} maxLength={120} placeholder="Puliyoor" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            name="description"
            required
            minLength={10}
            maxLength={4000}
            placeholder={type === "house" ? "Bedrooms, built-up area, road access, water…" : "Road access, shape of plot, trees, water…"}
          />
        </Field>
      </Card>

      <Card title="Price & documents">
        <Field label="Expected price" hint="₹">
          <Input name="expected_price" required inputMode="numeric" placeholder="55,00,000" />
        </Field>
        <Switch checked={negotiable} onChange={setNegotiable} label="Price is negotiable" />
        <Switch checked={docs} onChange={setDocs} label="Legal documents available" />
        {docs && <Input name="documents_note" maxLength={500} placeholder="e.g. Title deed, tax receipt, survey sketch" />}
      </Card>

      <Card title="Your details" hint="Never shown publicly">
        <Field label="Name">
          <Input name="seller_name" required minLength={2} maxLength={80} autoComplete="name" />
        </Field>
        <Field label="Phone">
          <Input name="seller_phone" required inputMode="tel" autoComplete="tel" placeholder="98470 12345" />
        </Field>
      </Card>

      <section className="rounded-[28px] bg-brand-soft p-5">
        <h2 className="font-bold">Brokerage terms</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li>• Listing is <b>free</b>.</li>
          <li>
            • Seller brokerage: <b>{config?.brokerage.seller_pct ?? 2}% + GST</b>, only when the sale closes through Nilayam.
          </li>
          <li>• Buyers pay {config?.brokerage.buyer_pct ?? 1}% + GST separately.</li>
          <li>• Your name, phone and exact address stay private. Buyers contact Nilayam.</li>
          <li>• We confirm any price change with you before updating the listing.</li>
        </ul>
        <button type="button" role="checkbox" aria-checked={agree} onClick={() => setAgree(!agree)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-surface p-3.5 text-left text-sm font-semibold">
          <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition", agree ? "border-brand bg-brand text-brand-ink" : "border-line")}>
            {agree && <Check size={15} strokeWidth={3} />}
          </span>
          I agree to the brokerage terms
        </button>
      </section>

      {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm font-medium text-sold">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || !config}>
        {busy ? "Submitting…" : "Submit property"}
      </Button>
    </form>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5 rounded-[28px] bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">{title}</h2>
        {hint && <span className="text-xs text-sub">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Done({ refCode, contactWa }: { refCode: string; contactWa?: string }) {
  const toast = useToast();
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
      <div className="animate-pop mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand text-brand-ink shadow-float">
        <Check size={40} strokeWidth={3} />
      </div>
      <h1 className="text-2xl font-extrabold">Received!</h1>
      <p className="mt-1 max-w-xs text-sub">We'll call you within 24 hours to confirm the details.</p>
      <button
        onClick={() => navigator.clipboard?.writeText(refCode).then(() => toast("Reference copied"))}
        className="mt-6 flex items-center gap-3 rounded-[22px] bg-surface px-5 py-3.5 shadow-card"
      >
        <span className="text-left">
          <span className="block text-xs text-sub">Your reference</span>
          <span className="font-mono text-lg font-bold tracking-wider">{refCode}</span>
        </span>
        <Copy size={18} className="text-sub" />
      </button>
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
