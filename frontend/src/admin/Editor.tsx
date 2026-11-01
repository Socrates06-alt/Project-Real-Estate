import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ExternalLink, Eye, EyeOff, MessageCircle, Phone } from "lucide-react";
import { ApiError, type PropertyType } from "@/lib/api";
import { cents, inr, shortDate, typeLabel } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/States";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePrivateImage, useAdmin } from "./auth";
import { ListingBadge, Panel, SubmissionBadge } from "./ui";
import type { AdminListing, AdminSubmission } from "./types";

type Draft = Pick<
  AdminListing,
  "title" | "property_type" | "land_area_cents" | "location" | "description" | "price" | "negotiable" | "documents_available" | "documents_note" | "photo_ids"
>;
const FIELDS: (keyof Draft)[] = ["title", "property_type", "land_area_cents", "location", "description", "price", "negotiable", "documents_available", "documents_note"];

export default function Editor() {
  const { id } = useParams();
  const { call } = useAdmin();
  const { data, error, reload } = useAsync(async () => {
    const sub = await call<AdminSubmission>(`/submissions/${id}`);
    const listing = sub.listing_id ? await call<AdminListing>(`/listings/${sub.listing_id}`) : null;
    return { sub, listing };
  }, [id]);

  if (error) return <ErrorState message={error.message} retry={reload} />;
  if (!data) return <div className="h-96 animate-pulse rounded-3xl border border-line bg-surface" />;
  const { sub, listing } = data;

  return (
    <>
      <Link to="/admin" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
        <ChevronLeft size={16} /> Back
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Original sub={sub} />
        {listing ? <ListingForm key={listing.updated_at} sub={sub} listing={listing} reload={reload} /> : <NoDraft sub={sub} reload={reload} />}
      </div>
    </>
  );
}

function Original({ sub }: { sub: AdminSubmission }) {
  const phone = sub.seller_phone.replace(/\D/g, "");
  return (
    <Panel className="h-fit bg-muted/60 shadow-none lg:sticky lg:top-20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sub uppercase">Original submission · read only</p>
          <h1 className="mt-1 text-xl font-semibold">{sub.seller_name}</h1>
          <p className="text-sm text-sub">
            {sub.ref_code} · {shortDate(sub.created_at)}
          </p>
        </div>
        <SubmissionBadge status={sub.status} />
      </div>
      <div className="mb-4 flex gap-2">
        <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-full bg-wa px-4 text-sm font-semibold text-white">
          <MessageCircle size={16} /> WhatsApp
        </a>
        <a href={`tel:${sub.seller_phone}`} className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold">
          <Phone size={15} /> {sub.seller_phone}
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {sub.photos.map((p) => (
          <PrivatePhoto key={p.id} url={p.url} />
        ))}
      </div>
      <dl className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface text-sm">
        {[
          ["Type", typeLabel(sub.property_type)],
          ["Area", cents(sub.land_area_cents)],
          ["Expected price", inr(sub.expected_price)],
          ["Negotiable", sub.negotiable ? "Yes" : "No"],
          ["Documents", sub.documents_available ? `Yes${sub.documents_note ? ` — ${sub.documents_note}` : ""}` : "Not yet"],
          ["Location", sub.location],
          ["Consent", `${sub.consent_version} · ${shortDate(sub.consent_at)}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-sub">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm whitespace-pre-line">{sub.description}</p>
      {sub.status_note && <p className="mt-3 text-sm text-sub">Note: {sub.status_note}</p>}
    </Panel>
  );
}

function PrivatePhoto({ url, dim }: { url: string; dim?: boolean }) {
  const src = usePrivateImage(url);
  return (
    <div className={cn("aspect-square overflow-hidden rounded-2xl bg-line transition", dim && "opacity-30 grayscale")}>
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

function NoDraft({ sub, reload }: { sub: AdminSubmission; reload: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = sub.status === "received" || sub.status === "under_review";

  async function run(path: string, body?: unknown) {
    setBusy(true);
    try {
      await call(path, { method: "POST", body });
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="flex flex-col items-center justify-center py-14 text-center">
      <p className="text-lg font-bold">{open ? "Ready to prepare a listing?" : "Not listed"}</p>
      <p className="mt-1 max-w-sm text-sm text-sub">
        {open
          ? "Call the seller to verify, then create a public draft. Name, phone and exact address are never copied."
          : "This submission was rejected."}
      </p>
      {open && (
        <div className="mt-6 flex gap-2">
          <Button disabled={busy} onClick={() => run(`/submissions/${sub.id}/draft`)}>
            Create public draft
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              const note = window.prompt("Reason for rejecting (internal)?");
              if (note !== null) run(`/submissions/${sub.id}/reject`, { note });
            }}
          >
            Reject
          </Button>
        </div>
      )}
    </Panel>
  );
}

function ListingForm({ sub, listing, reload }: { sub: AdminSubmission; listing: AdminListing; reload: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => pick(listing));
  const [busy, setBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setConfirmMsg(null);
  }, [d.price]);

  const live = listing.versions[0]?.snapshot as Record<string, unknown> | undefined;
  const unsaved = JSON.stringify(d) !== JSON.stringify(pick(listing));
  const differsFromLive =
    !!live && FIELDS.some((k) => String(live[k]) !== String(k === "land_area_cents" ? Number(listing[k]) : listing[k]));
  const sold = listing.state === "sold";

  async function save(silent = false) {
    await call(`/listings/${listing.id}`, { method: "PATCH", body: { ...d, price: Number(d.price) } });
    if (!silent) {
      toast("Draft saved — public listing unchanged");
      reload();
    }
  }

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.message.includes("confirmation")) setConfirmMsg(e.message);
      else toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const publish = () =>
    act(async () => {
      if (unsaved) await save(true);
      await call(`/listings/${listing.id}/publish`, { method: "POST" });
    }, listing.current_version ? "Reposted — new version is live" : "Published — now live on Explore");

  const confirmAndPublish = () =>
    act(async () => {
      if (unsaved) await save(true);
      await call(`/listings/${listing.id}/price-confirmation`, { method: "POST", body: { note: `Seller confirmed ${inr(Number(d.price))}` } });
      await call(`/listings/${listing.id}/publish`, { method: "POST" });
    }, "Price confirmed and published");

  const togglePhoto = (pid: string) =>
    set(
      "photo_ids",
      d.photo_ids.includes(pid) ? d.photo_ids.filter((x) => x !== pid) : sub.photos.map((p) => p.id).filter((x) => x === pid || d.photo_ids.includes(x)),
    );

  return (
    <Panel>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sub uppercase">Public listing · shown to buyers</p>
          <p className="mt-1 text-xl font-semibold">
            #{listing.number} {listing.current_version ? <span className="text-sm font-semibold text-sub">v{listing.current_version}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listing.state !== "draft" && (
            <Link to={`/p/${listing.id}`} target="_blank" className="grid h-9 w-9 place-items-center rounded-full bg-muted" aria-label="View public page">
              <ExternalLink size={16} />
            </Link>
          )}
          <ListingBadge state={listing.state} />
        </div>
      </div>

      {(unsaved || differsFromLive) && listing.current_version > 0 && !sold && (
        <p className="mb-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
          Draft differs from the live version. Repost to update the public listing.
        </p>
      )}

      <fieldset disabled={sold || busy} className="space-y-4">
        <Field label="Title">
          <Input value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
        </Field>
        <Segmented<PropertyType>
          value={d.property_type}
          onChange={(v) => set("property_type", v)}
          options={[
            { value: "house", label: "House" },
            { value: "land", label: "Land" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area" hint="cents">
            <Input value={d.land_area_cents} onChange={(e) => set("land_area_cents", e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Price" hint={inr(Number(d.price) || 0)}>
            <Input value={d.price} onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")))} inputMode="numeric" />
          </Field>
        </div>
        <Field label="Public location" hint="area only, no house name">
          <Input value={d.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={d.description} onChange={(e) => set("description", e.target.value)} rows={5} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch checked={d.negotiable} onChange={(v) => set("negotiable", v)} label="Negotiable" />
          <Switch checked={d.documents_available} onChange={(v) => set("documents_available", v)} label="Documents available" />
        </div>
        <Field label="Documents note">
          <Input value={d.documents_note} onChange={(e) => set("documents_note", e.target.value)} placeholder="Title deed, tax receipt…" />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Photos · tap to show / hide</p>
          <div className="grid grid-cols-3 gap-2">
            {sub.photos.map((p) => {
              const on = d.photo_ids.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => togglePhoto(p.id)} className="relative">
                  <PrivatePhoto url={p.url} dim={!on} />
                  <span className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white">
                    {on ? <Eye size={14} /> : <EyeOff size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {confirmMsg && (
        <div className="mt-4 rounded-2xl bg-amber-100 p-4 text-sm text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
          <p className="flex gap-2 font-semibold">
            <AlertTriangle size={17} className="shrink-0" /> Material price change
          </p>
          <p className="mt-1">{confirmMsg}. Call the seller and confirm {inr(Number(d.price))} first.</p>
          <Button size="sm" className="mt-3" disabled={busy} onClick={confirmAndPublish}>
            Seller confirmed — publish
          </Button>
        </div>
      )}

      {!sold && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="soft" disabled={busy || !unsaved} onClick={() => act(() => save(true), "Draft saved — public listing unchanged")}>
            Save draft
          </Button>
          <Button disabled={busy || !d.photo_ids.length} onClick={publish} className="flex-1">
            {listing.current_version ? "Repost" : "Publish"}
          </Button>
          {listing.state === "published" && (
            <>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => window.confirm("Mark this property as sold?") && act(() => call(`/listings/${listing.id}/sold`, { method: "POST" }), "Marked as sold")}
              >
                Mark sold
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => window.confirm("Take this listing off Explore?") && act(() => call(`/listings/${listing.id}/withdraw`, { method: "POST" }), "Withdrawn")}
              >
                Withdraw
              </Button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function pick(l: AdminListing): Draft {
  return {
    title: l.title,
    property_type: l.property_type,
    land_area_cents: String(Number(l.land_area_cents)),
    location: l.location,
    description: l.description,
    price: l.price,
    negotiable: l.negotiable,
    documents_available: l.documents_available,
    documents_note: l.documents_note,
    photo_ids: l.photo_ids,
  };
}
