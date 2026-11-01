import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, FileCheck2, FileClock, Info, MapPin, MessageCircle, Phone, Ruler, Share2 } from "lucide-react";
import { api, type Contact, type Listing } from "@/lib/api";
import { cents, inr, shortDate, typeLabel } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { VisitSheet } from "@/components/VisitSheet";
import { ErrorState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const visitOpen = params.get("visit") === "1";

  const back = () => (window.history.length > 1 ? nav(-1) : nav("/"));

  async function share() {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title: l?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* cancelled */
    }
  }

  if (error)
    return (
      <div className="pt-6">
        <ErrorState message={error.message} retry={reload} />
      </div>
    );
  if (!l) return <div className="-mx-4 aspect-square animate-pulse bg-muted" />;

  const sold = l.status === "sold";
  const roundBtn = "grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md";

  return (
    <div className="pb-28">
      <PhotoCarousel
        photos={l.photos}
        type={l.property_type}
        className="-mx-4 aspect-square rounded-b-[36px] sm:mt-4 sm:rounded-[36px]"
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
          <Badge>{typeLabel(l.property_type)}</Badge>
          <span className="ml-auto text-xs text-sub">#{l.number}</span>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="text-[32px] leading-none font-extrabold tracking-tight">{inr(l.price)}</h1>
          {l.negotiable && !sold && <span className="text-sm font-semibold text-brand">Negotiable</span>}
        </div>
        <p className="mt-2 text-[17px] font-semibold">{l.title}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-sub">
          <MapPin size={15} /> {l.location}
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Fact icon={<Ruler size={18} />} label="Area" value={cents(l.land_area_cents)} />
        <Fact
          icon={l.documents_available ? <FileCheck2 size={18} /> : <FileClock size={18} />}
          label="Documents"
          value={l.documents_available ? "Available" : "Not yet"}
        />
      </section>

      <section className="mt-3 rounded-[24px] bg-surface p-5 shadow-card">
        <h2 className="mb-2 text-sm font-bold text-sub">About this property</h2>
        <p className="leading-relaxed whitespace-pre-line">{l.description}</p>
        {l.documents_note && (
          <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm">
            <span className="font-semibold">Documents: </span>
            {l.documents_note}
          </p>
        )}
        <p className="mt-3 text-xs text-sub">Listed {shortDate(l.published_at)} · Exact address shared before the visit.</p>
      </section>

      <section className="mt-3 flex gap-3 rounded-[24px] bg-brand-soft p-5 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-brand" />
        <p>
          <span className="font-bold">Buyer brokerage: {l.brokerage.buyer_pct}% + GST</span>
          <span className="block text-sub">Paid only when the sale closes. Nilayam arranges and joins every visit.</span>
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl gap-2">
          {sold ? (
            <a href={waLink(l.contact)} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "wa", size: "lg" }))}>
              <MessageCircle size={19} /> Ask about similar properties
            </a>
          ) : (
            <>
              <a href={waLink(l.contact, l)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={cn(buttonVariants({ variant: "wa" }), "h-13 w-13 shrink-0 px-0")}>
                <MessageCircle size={21} />
              </a>
              <a href={telLink(l.contact)} aria-label="Call" className={cn(buttonVariants({ variant: "outline" }), "h-13 w-13 shrink-0 px-0")}>
                <Phone size={20} />
              </a>
              <Button size="lg" onClick={() => setParams({ visit: "1" }, { replace: true })}>
                <CalendarDays size={19} /> Request a visit
              </Button>
            </>
          )}
        </div>
      </div>

      {!sold && <VisitSheet listingId={l.id} open={visitOpen} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-surface p-4 shadow-card">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
      <p className="mt-3 text-xs text-sub">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
