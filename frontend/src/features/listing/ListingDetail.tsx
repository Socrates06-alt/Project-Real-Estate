import { t } from "@/shared/i18n";
import { useState } from "react";
import { TYPE_TONE } from "@/shared/lib/propertyType";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, CalendarDays, Link2, ChevronLeft, FileCheck2, Info, MapPin, MessageCircle, Phone, Ruler, Share2, Users } from "lucide-react";
import { api, getConfig, type Contact, type Listing } from "@/shared/api/client";
import { cents, priceDisplay, shortDate, typeLabel } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { PhotoCarousel } from "@/shared/components/PhotoCarousel";
import { Sheet } from "@/shared/ui/sheet";
import { VisitSheet } from "@/shared/components/VisitSheet";
import { ErrorState } from "@/shared/components/States";
import { Badge } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { telLink, waLink } from "@/shared/components/contact";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";
import { SimilarProperties } from "./SimilarProperties";
import { SaveButton } from "@/shared/components/SaveButton";

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
    if (await copyText(shareUrl)) toast(t("listing.copied"));
    else toast(t("listing.copyFailed"));
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
  const price = priceDisplay(l.price, l.property_type, l.land_area_cents);
  // Solid white buttons + a soft dark fade at the top: visible on any photo (bright sky, white walls, dark trees).
  const overBtn =
    "pointer-events-auto flex h-11 items-center justify-center rounded-full bg-white text-[#1a1d2e] shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition active:scale-95";

  return (
    <div className="pb-28">
      <PhotoCarousel
        photos={l.photos}
        type={l.property_type}
        className="-mx-4 aspect-[4/3.6] sm:mx-0 sm:mt-4 sm:rounded-3xl"
        overlay={
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/45 via-black/15 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
            <button onClick={back} aria-label={t("listing.back")} className={`${overBtn} w-11`}>
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <div className="pointer-events-auto flex gap-2.5">
              <SaveButton id={l.id} />
              <button
                onClick={share}
                aria-label={t("listing.share")}
                className="grid h-11 w-11 place-items-center rounded-full bg-brand text-brand-ink shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_4px_14px_rgba(0,0,0,0.25)] transition active:scale-90"
              >
                <Share2 size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        }
      />

      <section className="pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sold ? "sold" : "brand"}>{sold ? t("common.sold") : t("listing.available")}</Badge>
          {!sold && (
            <Badge tone="verified">
              <BadgeCheck size={13} /> {t("common.verified")}
            </Badge>
          )}
          {!sold && l.price_reduced && <Badge tone="brand">{t("common.priceReduced")}</Badge>}
          <Badge tone={TYPE_TONE[l.property_type]}>{typeLabel(l.property_type)}</Badge>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <h1 className={cn("text-[32px] leading-none font-bold tracking-tight", sold ? "text-sub" : "text-price")}>
            {price.main}
            {price.unit && <span className="ml-0.5 text-lg font-semibold">{price.unit}</span>}
          </h1>
          {l.negotiable && !sold && <span className="text-sm font-semibold text-brand">{t("common.negotiable")}</span>}
          {price.side && !sold && <span className="ml-auto text-sm font-medium text-sub">{price.side}</span>}
        </div>
        {!isAutoTitle(l.title) && <p className="mt-2 text-lg font-medium">{l.title}</p>}
        <p className={cn("flex items-center gap-1 text-sm text-sub", isAutoTitle(l.title) ? "mt-2" : "mt-1")}>
          <MapPin size={15} /> {l.location}
        </p>
      </section>

      {/* Only what's actually known is shown; nothing empty or "not yet". */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <Fact tone="bg-land-soft text-land" icon={<Ruler size={18} />} label={t("listing.area")} value={cents(l.land_area_cents)} />
        {l.documents_available && (
          <Fact tone="bg-verified-soft text-verified" icon={<FileCheck2 size={18} />} label={t("listing.documents")} value={t("listing.docsReady")} />
        )}
      </section>

      <section className="mt-3 card p-5">
        <h2 className="text-base font-semibold">{t("listing.about")}</h2>
        {l.description && <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line">{l.description}</p>}
        <dl className="mt-3 divide-y divide-line rounded-2xl bg-muted/60 text-sm">
          {l.documents_note && (
            <InfoRow icon={<FileCheck2 size={17} className="text-verified" />} label={t("listing.documents")} value={l.documents_note} />
          )}
          <InfoRow icon={<CalendarDays size={17} className="text-brand" />} label={t("listing.listedOn")} value={shortDate(l.listed_at)} />
          {config.data?.rera_number && (
            <InfoRow icon={<BadgeCheck size={17} className="text-verified" />} label={t("common.rera")} value={config.data.rera_number} />
          )}
        </dl>
      </section>

      {!sold && <ShareWithFamily listing={l} shareUrl={shareUrl} />}


      <section className="mt-3 flex gap-3 rounded-[28px] bg-sky p-5 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-sky-ink" />
        <p>
          <span className="font-semibold">{t("listing.buyerBrokerage", { pct: l.brokerage.buyer_pct })}</span>
          <span className="block text-sub">{t("listing.paidOnClose")}</span>
        </p>
      </section>

      <SimilarProperties listingId={l.id} place={l.location} />

      <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
        <div className="glass flex w-full max-w-sm items-center gap-1 rounded-full p-1 shadow-float">
          {sold ? (
            <a href={waLink(l.contact)} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "primary" }), "h-[52px] flex-1 rounded-full")}>
              <MessageCircle size={19} /> {t("listing.askSimilar")}
            </a>
          ) : (
            <>
              <a href={telLink(l.contact)} className={cn(buttonVariants({ variant: "accent" }), "h-[52px] flex-[1.6] rounded-full text-base")}>
                <Phone size={19} /> {t("common.call")}
              </a>
              <a href={waLink(l.contact, l)} target="_blank" rel="noreferrer" className={pillAction}>
                <MessageCircle size={21} className="text-wa" />
                {t("common.whatsapp")}
              </a>
              <button onClick={() => setParams({ visit: "1" }, { replace: true })} className={pillAction}>
                <CalendarDays size={20} className="text-brand" />
                {t("common.visit")}
              </button>
            </>
          )}
        </div>
      </div>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={t("listing.shareTitle")}>
        <div className="grid gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${l.title} · ${l.location}\n${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setShareOpen(false)}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <MessageCircle size={19} className="text-wa" /> {t("listing.shareWa")}
          </a>
          <button onClick={copyLink} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            <Link2 size={19} className="text-brand" /> {t("listing.copyLink")}
          </button>
        </div>
      </Sheet>
      {!sold && <VisitSheet listingId={l.id} open={visitOpen} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}

const pillAction =
  "flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-medium text-ink transition-colors hover:bg-[var(--glass-active)]";

/** One row of property details: label on the left, its value on the same line at the right edge. */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <dt className="shrink-0 text-sub">{label}</dt>
      <dd className="min-w-0 flex-1 pl-4 text-right font-semibold whitespace-pre-line">{value}</dd>
    </div>
  );
}

function Fact({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="card-sm flex items-center gap-3 px-3.5 py-3">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}>{icon}</span>
      <div className="min-w-0 leading-tight">
        <p className="text-xs text-sub">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
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

// Automatic titles ("Land for sale", "House for sale"...) repeat the type badge, so they aren't shown.
// A title written by the admin ("Renovated 2BHK on a quiet road") is shown.
function isAutoTitle(title: string) {
  return /^(house|land|commercial|commercial property)\s+for\s+sale\.?$/i.test(title.trim());
}

/** Indian buyers decide with family: one big, obvious WhatsApp share with a ready message. */
function ShareWithFamily({ listing: l, shareUrl }: { listing: Listing; shareUrl: string }) {
  const price = priceDisplay(l.price, l.property_type, l.land_area_cents);
  const text = t("share.message", {
    what: `${typeLabel(l.property_type)} · ${cents(l.land_area_cents)}`,
    place: l.location,
    price: `${price.main}${price.unit}`,
    url: shareUrl,
  });
  return (
    <div className="mt-3 flex items-center gap-2 rounded-[20px] bg-wa/10 px-3 py-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 py-1.5 transition active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wa text-white">
          <Users size={21} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-base font-semibold">{t("share.family")}</span>
          <span className="block text-sm text-sub">{t("share.familySub")}</span>
        </span>
      </a>
    </div>
  );
}
