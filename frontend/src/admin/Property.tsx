import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ImagePlus, ChevronDown, ChevronLeft, ExternalLink, Eye, EyeOff } from "lucide-react";
import { ApiError, type PropertyType } from "@/lib/api";
import { cents, inr, shortDate, typeLabel } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/States";
import { AffixInput, Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "./auth";
import { AreaInput } from "@/components/AreaInput";
import { ContactButtons, GroupBadge, PrivatePhoto, VisitCard } from "./ui";
import type { Property, PublicForm } from "./types";

const BIG_CHANGE_PCT = 5; // matches the backend default; the backend has the final say

export default function PropertyPage() {
  const { id } = useParams();
  const { call } = useAdmin();
  const { data, error, reload } = useAsync(() => call<Property>(`/properties/${id}`), [id]);

  if (error) return <ErrorState message={error.message} retry={reload} />;
  if (!data) return <div className="mt-12 h-96 shimmer rounded-[28px]" />;
  // Re-mount the editor whenever fresh data arrives so the form resets cleanly.
  return <Editor key={JSON.stringify(data.form) + data.group} p={data} reload={reload} />;
}

function Editor({ p, reload }: { p: Property; reload: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState<PublicForm>(p.form);
  const [sellerConfirmed, setSellerConfirmed] = useState(false);
  const [forcePriceCheck, setForcePriceCheck] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [dontListOpen, setDontListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [areaText, setAreaText] = useState(String(p.form.land_area_cents));
  // Photos the admin adds here (when the seller didn't): shown and selected straight away.
  const [added, setAdded] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const photos = [...p.photos, ...added];

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).slice(0, 3 - photos.length).forEach((f) => form.append("photos", f));
    setUploading(true);
    try {
      const res = await call<{ photos: { id: string; url: string }[] }>(`/properties/${p.id}/photos`, { method: "POST", form });
      setAdded((a) => [...a, ...res.photos]);
      setF((x) => ({ ...x, photo_ids: [...x.photo_ids, ...res.photos.map((ph) => ph.id)] }));
      toast(res.photos.length > 1 ? "Photos added" : "Photo added");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const set = <K extends keyof PublicForm>(k: K, v: PublicForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const s = p.seller;
  const readOnly = p.group === "sold";
  const dirty = JSON.stringify(f) !== JSON.stringify(p.form);
  const priceChange = Math.abs(f.price - p.reference_price) / p.reference_price * 100;
  const needsConfirm = forcePriceCheck || priceChange > BIG_CHANGE_PCT;

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.message === "PRICE_NEEDS_SELLER_CONFIRMATION") {
        setForcePriceCheck(true);
        toast("Please confirm the new price with the seller");
      } else toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const publish = () =>
    run(
      () => call(`/properties/${p.id}/publish`, { method: "POST", body: { ...f, seller_confirmed: sellerConfirmed } }),
      p.group === "live" ? "Changes saved — buyers see the update" : "Published — now live",
    );

  const togglePhoto = (pid: string) =>
    set(
      "photo_ids",
      f.photo_ids.includes(pid) ? f.photo_ids.filter((x) => x !== pid) : photos.map((x) => x.id).filter((x) => x === pid || f.photo_ids.includes(x)),
    );

  const mainLabel = { new: "Publish", live: "Save changes", not_listed: "Publish again", sold: "" }[p.group];
  const mainDisabled = busy || (needsConfirm && !sellerConfirmed) || (p.group === "live" && !dirty);

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center gap-2">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav("/admin"))} aria-label="Back" className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{f.title}</p>
          <p className="text-xs text-sub">#{p.number}</p>
        </div>
        <GroupBadge group={p.group} />
        {p.listing_id && p.group !== "not_listed" && (
          <Link to={`/p/${p.listing_id}`} target="_blank" aria-label="See public page" className="card-sm grid h-10 w-10 shrink-0 place-items-center rounded-full">
            <ExternalLink size={16} />
          </Link>
        )}
      </header>

      {/* Seller */}
      <section className="card p-4">
        <p className="text-xs text-sub">Seller</p>
        <p className="text-lg font-semibold">{s.seller_name}</p>
        <p className="text-sm text-sub">{s.seller_phone}</p>
        {s.address && <p className="mt-1 mb-3 text-sm whitespace-pre-line">{s.address}</p>}
        {!s.address && <div className="mb-3" />}
        <ContactButtons phone={s.seller_phone} size="lg" />
        <button onClick={() => setShowOriginal(!showOriginal)} className="mt-3 flex w-full items-center justify-between py-1 text-sm font-medium text-sub">
          Seller's original details
          <ChevronDown size={18} className={cn("transition-transform", showOriginal && "rotate-180")} />
        </button>
        {showOriginal && (
          <dl className="mt-2 divide-y divide-line rounded-2xl bg-muted/60 text-sm">
            {[
              ["Type", typeLabel(s.property_type)],
              ["Area", cents(s.land_area_cents)],
              ["Asked price", inr(s.expected_price)],
              ["Negotiable", s.negotiable ? "Yes" : "No"],
              ["Documents", s.documents_available ? `Yes${s.documents_note ? ` — ${s.documents_note}` : ""}` : "Not yet uploaded"],
              ["Location", s.location],
              ["Full address", s.address || "—"],
              ["Submitted", shortDate(s.created_at)],
              ["Agreed to terms", `${s.consent_version} · ${shortDate(s.consent_at)}`],
              ["Description", s.description],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-sub">{k}</dt>
                <dd className="text-right font-medium whitespace-pre-line">{v}</dd>
              </div>
            ))}
            {s.status_note && <p className="px-4 py-3 text-sub">Note: {s.status_note}</p>}
          </dl>
        )}
      </section>

      {/* What buyers see */}
      <fieldset disabled={readOnly} className="space-y-4 card p-4">
        <legend className="sr-only">What buyers see</legend>
        <p className="text-xs text-sub">What buyers see</p>

        <div>
          <p className="mb-1.5 text-sm font-semibold">Photos</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((ph) => {
              const on = f.photo_ids.includes(ph.id);
              return (
                <button key={ph.id} type="button" onClick={() => togglePhoto(ph.id)} className="relative">
                  <PrivatePhoto url={ph.url} type={f.property_type} className={cn("aspect-square rounded-2xl transition", !on && "opacity-30 grayscale")} />
                  <span className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white">
                    {on ? <Eye size={14} /> : <EyeOff size={14} />}
                  </span>
                </button>
              );
            })}
            {!readOnly && photos.length < 3 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-sub transition hover:border-brand hover:text-brand">
                <ImagePlus size={22} />
                <span className="text-xs font-semibold">{uploading ? "Adding…" : "Add photo"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={uploading} onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))} />
              </label>
            )}
          </div>
          {!photos.length && <p className="mt-1.5 text-xs text-sub">No photos yet. Add some so buyers can see the property.</p>}
        </div>

        <Field label="Price" hint={inr(f.price || 0)}>
          <AffixInput prefix="₹" inputMode="numeric" value={f.price ? f.price.toLocaleString("en-IN") : ""} onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")))} />
        </Field>

        {needsConfirm && !readOnly && (
          <button
            type="button"
            role="checkbox"
            aria-checked={sellerConfirmed}
            onClick={() => setSellerConfirmed(!sellerConfirmed)}
            className="flex w-full items-center gap-3 rounded-2xl bg-sky p-3.5 text-left text-[15px] text-sky-ink"
          >
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2", sellerConfirmed ? "border-brand bg-brand text-brand-ink" : "border-current")}>
              {sellerConfirmed && <Check size={15} strokeWidth={3} />}
            </span>
            <span>
              Price changed from {inr(p.reference_price)}. <b>Seller agreed to {inr(f.price)} on phone.</b>
            </span>
          </button>
        )}

        <Field label="Title">
          <Input value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Segmented<PropertyType>
          value={f.property_type}
          onChange={(v) => set("property_type", v)}
          options={[
            { value: "house", label: "House" },
            { value: "land", label: "Land" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
        <Field label="Land size">
          <AffixInput suffix="cents" inputMode="decimal" value={areaText}
            onChange={(e) => {
              setAreaText(e.target.value);
              set("land_area_cents", Number(e.target.value) || 0);
            }} />
        </Field>
        <Field label="Location" hint={f.lat != null ? "On map search" : "Pick a suggestion to include in map search"}>
          <AreaInput
            value={{ name: f.location, lat: f.lat, lng: f.lng }}
            onChange={(a) => setF((x) => ({ ...x, location: a.name, lat: a.lat, lng: a.lng }))}
          />
        </Field>
        <Field label="Description">
          <Textarea rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Switch checked={f.negotiable} onChange={(v) => set("negotiable", v)} label="Negotiable" />
        <Switch checked={f.documents_available} onChange={(v) => set("documents_available", v)} label="Documents available" />
        {f.documents_available && <Input value={f.documents_note} placeholder="Title deed, tax receipt…" onChange={(e) => set("documents_note", e.target.value)} />}
      </fieldset>

      {/* Secondary actions */}
      {p.group === "new" && (
        <button onClick={() => setDontListOpen(true)} className="w-full py-2 text-center text-[15px] text-sub">
          Don't list this property
        </button>
      )}
      {p.group === "live" && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => window.confirm("Mark this property as sold?") && run(() => call(`/properties/${p.id}/sold`, { method: "POST" }), "Marked as sold")}>
            Mark as sold
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => window.confirm("Take this property off the app?") && run(() => call(`/properties/${p.id}/take-down`, { method: "POST" }), "Taken down")}>
            Take down
          </Button>
        </div>
      )}

      {/* Visits */}
      {p.visits.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 font-semibold">Visit requests · {p.visits.length}</h2>
          {p.visits.map((v) => (
            <VisitCard key={v.id} visit={v} onChange={reload} />
          ))}
        </section>
      )}

      {/* Main action */}
      {mainLabel && (
        <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="glass rounded-full p-1 shadow-float">
            <Button className="h-[52px] min-w-[200px] rounded-full px-8 text-base" disabled={mainDisabled} onClick={publish}>
              {busy ? "Saving…" : mainLabel}
            </Button>
          </div>
        </div>
      )}

      <DontListSheet
        open={dontListOpen}
        onClose={() => setDontListOpen(false)}
        onConfirm={(note) => {
          setDontListOpen(false);
          run(() => call(`/properties/${p.id}/not-listed`, { method: "POST", body: { note } }), "Marked as not listed");
        }}
      />
    </div>
  );
}

function DontListSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Don't list this property?">
      <p className="mb-3 text-sm text-sub">The seller's details stay saved. You can still publish it later.</p>
      <Field label="Reason (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Outside our area" />
      </Field>
      <Button size="lg" className="mt-5" onClick={() => onConfirm(note)}>
        Don't list
      </Button>
    </Sheet>
  );
}
