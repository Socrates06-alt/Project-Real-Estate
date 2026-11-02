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
          <Badge>{typeLabel(l.property_type)}</Badge>
          <span className="ml-auto text-xs text-sub">#{l.number}</span>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="text-[30px] leading-none font-semibold tracking-tight">{inr(l.price)}</h1>
          {l.negotiable && !sold && <span className="text-sm font-semibold text-brand">Negotiable</span>}
        </div>
        <p className="mt-2 text-lg font-medium">{l.title}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-sub">
          <MapPin size={15} /> {l.location}
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Fact icon={<Ruler size={18} />} label="Area" value={cents(l.land_area_cents)} />
        <Fact
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
        <p className="mt-3 text-xs text-sub">Listed {shortDate(l.published_at)} · Exact location shared when we arrange your visit.</p>
      </section>


      <section className="mt-3 flex gap-3 rounded-3xl bg-brand-soft p-5 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-brand" />
        <p>
          <span className="font-semibold">Buyer brokerage: {l.brokerage.buyer_pct}% + GST</span>
          <span className="block text-sub">Paid only when the sale closes. Nilayam arranges and joins every visit.</span>
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
              <a href={waLink(l.contact, l)} target="_blank" rel="noreferrer" className={pillAction}>
                <MessageCircle size={22} className="text-wa" />
                WhatsApp
              </a>
              <a href={telLink(l.contact)} className={pillAction}>
                <Phone size={21} className="text-brand" />
                Call
              </a>
              <Button className="h-[52px] flex-[1.6] rounded-full text-[15px]" onClick={() => setParams({ visit: "1" }, { replace: true })}>
                <CalendarDays size={19} /> Request visit
              </Button>
            </>
          )}
        </div>
      </div>

      {!sold && <VisitSheet listingId={l.id} open={visitOpen} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}

const pillAction =
  "flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-medium text-ink transition-colors hover:bg-[var(--glass-active)]";

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
      <p className="mt-3 text-xs text-sub">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
