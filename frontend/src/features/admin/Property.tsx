import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ExternalLink, Trash2 } from "lucide-react";
import { ApiError, type PropertyType } from "@/shared/api/client";
import { inr, shortTitle } from "@/shared/lib/format";
import { shrinkImage } from "@/shared/lib/image";
import { useAsync } from "@/shared/lib/useAsync";
import { cn } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/components/States";
import { AffixInput, Field, Input, Textarea } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { useAdmin } from "@/features/admin/auth";
import { AreaInput } from "@/shared/components/AreaInput";
import { GroupBadge, VisitCard } from "@/features/admin/ui";
import { SellerCard } from "./property/SellerCard";
import { EditSellerSheet } from "./property/EditSellerSheet";
import { PhotoSelector } from "./property/PhotoSelector";
import { DontListSheet } from "./property/DontListSheet";
import type { Property, PublicForm } from "@/features/admin/types";

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
  const [dontListOpen, setDontListOpen] = useState(false);
  const [editSeller, setEditSeller] = useState(false);
  const [busy, setBusy] = useState(false);
  const [areaText, setAreaText] = useState(String(p.form.land_area_cents));
  // Photos the admin adds here (when the seller didn't): shown and selected straight away.
  const [added, setAdded] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleted, setDeleted] = useState<string[]>([]);
  const photos = [...p.photos, ...added].filter((ph) => !deleted.includes(ph.id));

  async function deletePhoto(pid: string) {
    try {
      await call(`/photos/${pid}`, { method: "DELETE" });
      setDeleted((d) => [...d, pid]);
      setF((x) => ({ ...x, photo_ids: x.photo_ids.filter((id) => id !== pid) }));
      toast(p.group === "live" ? "Photo deleted. Save changes to update what buyers see." : "Photo deleted");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    setUploading(true);
    try {
      const picked = Array.from(files).slice(0, 3 - photos.length);
      (await Promise.all(picked.map(shrinkImage))).forEach((f) => form.append("photos", f));
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

  const readOnly = p.group === "sold" || p.group === "removed";
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

  const mainLabel = { new: "Publish", live: "Save changes", not_listed: "Publish again", sold: "", removed: "" }[p.group];
  const mainDisabled = busy || (needsConfirm && !sellerConfirmed) || (p.group === "live" && !dirty);

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center gap-2">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav("/admin"))} aria-label="Back" className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{shortTitle(f.title)}</p>
          <p className="text-xs text-sub">#{p.number}</p>
        </div>
        <GroupBadge group={p.group} />
        {p.listing_id && p.group !== "not_listed" && (
          <Link to={`/p/${p.listing_id}`} target="_blank" aria-label="See public page" className="card-sm grid h-10 w-10 shrink-0 place-items-center rounded-full">
            <ExternalLink size={16} />
          </Link>
        )}
      </header>

      <SellerCard seller={p.seller} onEdit={p.admin_entered ? () => setEditSeller(true) : undefined} />

      {/* What buyers see */}
      <fieldset disabled={readOnly} className="space-y-4 card p-4">
        <legend className="sr-only">What buyers see</legend>
        <p className="text-xs text-sub">What buyers see</p>

        <PhotoSelector
          photos={photos}
          selected={f.photo_ids}
          type={f.property_type}
          readOnly={readOnly}
          uploading={uploading}
          onToggle={togglePhoto}
          onAdd={addPhotos}
          onDelete={deletePhoto}
        />

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
        <Field label="Location" hint={f.lat != null ? "On map search" : "Not on map search"}>
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
      {p.group === "removed" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
          <span className="text-sub">Removed from your lists. The record is kept.</span>
          <button
            disabled={busy}
            onClick={() => run(() => call(`/properties/${p.id}/restore`, { method: "POST" }), "Restored")}
            className="shrink-0 font-semibold text-brand underline underline-offset-2"
          >
            Restore
          </button>
        </div>
      )}
      {(p.group === "not_listed" || p.group === "sold") && (
        <button
          disabled={busy}
          onClick={() =>
            window.confirm(`Remove #${p.number} from your lists? It's kept on record and can be restored from search.`) &&
            run(() => call(`/properties/${p.id}/remove`, { method: "POST" }), "Removed")
          }
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[15px] font-medium text-sold"
        >
          <Trash2 size={16} /> Remove property
        </button>
      )}
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

      {p.admin_entered && <EditSellerSheet property={p} open={editSeller} onClose={() => setEditSeller(false)} onSaved={reload} />}

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
