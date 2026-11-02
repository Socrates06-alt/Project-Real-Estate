import { useState } from "react";
import { TYPE_TONE } from "@/lib/propertyType";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, CalendarDays, Clock3, Link2, ChevronLeft, FileCheck2, FileClock, Info, MapPin, MessageCircle, Phone, Ruler, Share2 } from "lucide-react";
import { api, getConfig, type Contact, type Listing } from "@/lib/api";
import { cents, inr, perCent, shortDate, typeLabel, updatedAgo } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { Sheet } from "@/components/ui/sheet";
import { VisitSheet } from "@/components/VisitSheet";
import { ErrorState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { telLink, waLink } from "@/components/contact";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Detail = Listing & { contact: Contact; brokerage: { buyer_pct: number; gst_extra: boolean } };

export default function ListingDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: l, error, reload } = useAsync(() => api<Detail>(`/api/listings/${id}`), [id]);
  const config = useAsync(getConfig, []);
  const visitOpen = params.get("visit") === "1";

  const back = () => (window.history.length > 1 ? nav(-1) : nav("/"));

  const shareUrl = window.location.href.split("?")[0];
  const [shareOpen, setShareOpen] = useState(false);

  // Phone's own share menu if available; otherwise our Share popup (WhatsApp / Copy link).
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: l?.title, url: shareUrl });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user closed the menu
      }
    }
    setShareOpen(true);
  }

  async function copyLink() {
    if (await copyText(shareUrl)) toast("Link copied");
    else toast("Couldn't copy — please copy the link from the address bar");
    setShareOpen(false);
  }


  if (error)
    return (
      <div className="pt-6">
        <ErrorState message={error.message} retry={reload} />
      </div>
    );
  if (!l) return <div className="-mx-4 aspect-square animate-pulse bg-muted" />;

  const sold = l.status === "sold";
  const roundBtn = "glass grid h-11 w-11 place-items-center rounded-full text-ink shadow-card";

  return (
    <div className="pb-28">
      <PhotoCarousel
        photos={l.photos}
        type={l.property_type}
        className="-mx-4 aspect-[4/3.6] sm:mx-0 sm:mt-4 sm:rounded-3xl"
        overlay={
          <div className="absolute inset-x-0 top-0 flex justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button onClick={back} aria-label="Back" className={roundBtn}>
              <ChevronLeft size={22} />
            </button>
            <button onClick={share} aria-label="Share" className={roundBtn}>
              <Share2 size={18} />
            </button>
          </div>
        }
      />

      <section className="pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sold ? "sold" : "brand"}>{sold ? "Sold" : "Available"}</Badge>
          {!sold && (
            <Badge tone="verified">
              <BadgeCheck size={13} /> Verified by LandFinder
            </Badge>
          )}
          {!sold && l.price_reduced && <Badge tone="brand">Price reduced</Badge>}
          <Badge tone={TYPE_TONE[l.property_type]}>{typeLabel(l.property_type)}</Badge>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <h1 className={cn("text-[32px] leading-none font-bold tracking-tight", sold ? "text-sub" : "text-price")}>{inr(l.price)}</h1>
          {l.negotiable && !sold && <span className="text-sm font-semibold text-brand">Negotiable</span>}
          {l.property_type === "land" && !sold && <span className="ml-auto text-sm font-medium text-sub">{perCent(l.price, l.land_area_cents)}</span>}
        </div>
        <p className="mt-2 text-lg font-medium">{l.title}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-sub">
          <MapPin size={15} /> {l.location}
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Fact tone="bg-land-soft text-land" icon={<Ruler size={18} />} label="Area" value={cents(l.land_area_cents)} />
        <Fact
          tone={l.documents_available ? "bg-verified-soft text-verified" : "bg-muted text-sub"}
          icon={l.documents_available ? <FileCheck2 size={18} /> : <FileClock size={18} />}
          label="Documents"
          value={l.documents_available ? "Available" : "Not yet uploaded"}
        />
      </section>

      <section className="mt-3 card p-5">
        <h2 className="mb-2 text-sm font-medium text-sub">About this property</h2>
        <p className="leading-relaxed whitespace-pre-line">{l.description}</p>
        {l.documents_note && (
          <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm">
            <span className="font-semibold">Documents: </span>
            {l.documents_note}
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-sub">
          <span className="flex items-center gap-1 text-verified">
            <Clock3 size={13} /> {updatedAgo(l.published_at)}
          </span>
          · Listed {shortDate(l.listed_at)} · Exact location shared when we arrange your visit.
        </p>
        {config.data?.rera_number && <p className="mt-1 text-xs text-sub">Listed by LandFinder · Kerala RERA {config.data.rera_number}</p>}
      </section>


      <section className="mt-3 flex gap-3 rounded-[28px] bg-sky p-5 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-sky-ink" />
        <p>
          <span className="font-semibold">Buyer brokerage: {l.brokerage.buyer_pct}%</span>
          <span className="block text-sub">Paid only when the sale closes. LandFinder arranges and joins every visit.</span>
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
        <div className="glass flex w-full max-w-sm items-center gap-1 rounded-full p-1 shadow-float">
          {sold ? (
            <a href={waLink(l.contact)} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "primary" }), "h-[52px] flex-1 rounded-full")}>
              <MessageCircle size={19} /> Ask about similar properties
            </a>
          ) : (
            <>
              <a href={telLink(l.contact)} className={cn(buttonVariants({ variant: "accent" }), "h-[52px] flex-[1.6] rounded-full text-base")}>
                <Phone size={19} /> Call LandFinder
              </a>
              <a href={waLink(l.contact, l)} target="_blank" rel="noreferrer" className={pillAction}>
                <MessageCircle size={21} className="text-wa" />
                WhatsApp
              </a>
              <button onClick={() => setParams({ visit: "1" }, { replace: true })} className={pillAction}>
                <CalendarDays size={20} className="text-brand" />
                Visit
              </button>
            </>
          )}
        </div>
      </div>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share this property">
        <div className="grid gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${l.title} · ${l.location}\n${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setShareOpen(false)}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <MessageCircle size={19} className="text-wa" /> Share on WhatsApp
          </a>
          <button onClick={copyLink} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            <Link2 size={19} className="text-brand" /> Copy link
          </button>
        </div>
      </Sheet>
      {!sold && <VisitSheet listingId={l.id} open={visitOpen} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}

const pillAction =
  "flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-medium text-ink transition-colors hover:bg-[var(--glass-active)]";

function Fact({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="card p-4">
      <span className={cn("grid h-9 w-9 place-items-center rounded-2xl", tone)}>{icon}</span>
      <p className="mt-3 text-xs text-sub">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/** Copy text; works even where the clipboard API is blocked (plain http on a phone). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}
