import { useNavigate } from "react-router-dom";
import { BadgeCheck, FileCheck2, Home, IndianRupee, MapPin, MessageCircle, Quote, Route, Sprout, Trees } from "lucide-react";
import type { Contact, Listing } from "@/lib/api";
import { mediaUrl } from "@/lib/api";
import { inr, isNew } from "@/lib/format";
import { cn } from "@/lib/utils";
import { waLink } from "./contact";

export type HomeInfo = {
  tagline?: string;
  office?: string;
  founders?: { name: string; role?: string; photo?: string }[];
  testimonials?: { quote: string; name: string; place?: string }[];
  stats: { live: number; sold: number };
  areas: { name: string; count: number }[];
};

/** Welcome banner with a simple Kerala scene (backwaters, palms, golden sun). */
export function WelcomeBanner({ tagline }: { tagline?: string }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#cfe6fb_0%,#e8f3fd_45%,#fdf3d4_100%)] p-5 text-[#12263f] shadow-card">
      <svg viewBox="0 0 360 140" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <circle cx="300" cy="46" r="22" fill="#f6c343" opacity="0.9" />
        <path d="M0 98 C60 78 120 92 180 84 C240 76 300 92 360 82 V140 H0Z" fill="#9fd3a8" />
        <path d="M0 112 C70 102 140 116 210 108 C270 101 320 112 360 106 V140 H0Z" fill="#6fbf86" />
        <path d="M0 124 C80 118 160 128 240 122 C300 118 340 124 360 122 V140 H0Z" fill="#7fb9e6" opacity="0.85" />
        {[[250, 70], [278, 64], [322, 72]].map(([x, y]) => (
          <g key={x} fill="none" stroke="#3f7d4f" strokeWidth="3" strokeLinecap="round">
            <path d={`M${x} 112 Q${x - 3} ${y + 20} ${x} ${y}`} />
            <path d={`M${x} ${y} q-16 -2 -22 10 M${x} ${y} q16 -2 22 10 M${x} ${y} q-8 -12 -20 -12 M${x} ${y} q8 -12 20 -12`} strokeWidth="2.5" />
          </g>
        ))}
      </svg>
      <div className="relative max-w-[70%] pb-10">
        <p className="text-xs font-semibold tracking-wide text-[#a86b00] uppercase">{tagline || "Chengannur's own property service"}</p>
        <h2 className="mt-1 text-[22px] leading-tight font-bold">Find land &amp; homes in Chengannur</h2>
        <p className="mt-1 text-sm text-[#3e5570]">Verified listings. We arrange and join every visit.</p>
      </div>
    </section>
  );
}

type Tile = { label: string; icon: React.ReactNode; tone: string; onClick: () => void };

/** Quick ways in, with familiar icons. */
export function CategoryTiles(props: {
  onType: (t: "house" | "land") => void;
  onSearch: (q: string) => void;
  onDocs: () => void;
}) {
  const tiles: Tile[] = [
    { label: "Houses", icon: <Home size={22} />, tone: "bg-house-soft text-house", onClick: () => props.onType("house") },
    { label: "Land", icon: <Trees size={22} />, tone: "bg-land-soft text-land", onClick: () => props.onType("land") },
    { label: "Rubber / farm", icon: <Sprout size={22} />, tone: "bg-[color-mix(in_srgb,var(--wa)_14%,var(--surface))] text-wa", onClick: () => props.onSearch("rubber") },
    { label: "Under ₹30 L", icon: <IndianRupee size={22} />, tone: "bg-accent-soft text-[var(--accent-strong)]", onClick: () => props.onSearch("under 30 lakh") },
    { label: "Road access", icon: <Route size={22} />, tone: "bg-sky text-sky-ink", onClick: () => props.onSearch("road") },
    { label: "Documents ready", icon: <FileCheck2 size={22} />, tone: "bg-peach-soft text-peach", onClick: props.onDocs },
  ];
  return (
    <section className="grid grid-cols-3 gap-2.5">
      {tiles.map((t) => (
        <button key={t.label} onClick={t.onClick} className="card-sm card-hover flex flex-col items-center gap-2 px-2 py-3.5 text-center">
          <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", t.tone)}>{t.icon}</span>
          <span className="text-[13px] leading-tight font-medium">{t.label}</span>
        </button>
      ))}
    </section>
  );
}

/** Places that have properties right now, with counts. */
export function PopularAreas({ areas, onPick }: { areas: HomeInfo["areas"]; onPick: (name: string) => void }) {
  if (!areas.length) return null;
  return (
    <section>
      <h2 className="mb-2 px-1 font-semibold">Popular areas</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {areas.map((a) => (
          <button
            key={a.name}
            onClick={() => onPick(a.name)}
            className="card-sm flex shrink-0 items-center gap-2 rounded-full py-2 pr-2 pl-3 text-sm font-medium"
          >
            <MapPin size={15} className="text-brand" />
            {a.name}
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent-soft px-1.5 text-xs font-bold text-[var(--accent-strong)]">{a.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Sideways strip of listings from the last 7 days. */
export function NewThisWeek({ items }: { items: Listing[] }) {
  const nav = useNavigate();
  const fresh = items.filter((l) => l.status === "live" && isNew(l.listed_at)).slice(0, 8);
  if (!fresh.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 font-semibold">
        New this week
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink">{fresh.length}</span>
      </h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {fresh.map((l) => (
          <button key={l.id} onClick={() => nav(`/p/${l.id}`)} className="card-sm w-44 shrink-0 snap-start overflow-hidden p-1.5 text-left">
            <div className="aspect-[4/3] overflow-hidden rounded-[14px] bg-muted">
              {l.photos[0] && <img src={mediaUrl(l.photos[0])} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <p className="text-price px-1.5 pt-2 text-[17px] font-bold">{inr(l.price)}</p>
            <p className="truncate px-1.5 pb-1 text-xs text-sub">{l.location}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Who we are: tagline, real counts, founders, office, testimonials (all optional; from content.json). */
export function TrustStrip({ info }: { info: HomeInfo }) {
  const { stats, founders = [], testimonials = [], office } = info;
  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <BadgeCheck size={22} />
        </span>
        <div>
          <p className="font-semibold">Every listing verified by Nilayam</p>
          <p className="text-sm text-sub">We call every seller and check the property before it goes live.</p>
        </div>
      </div>

      {(stats.live > 0 || stats.sold > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <Stat value={stats.live} label="Properties for sale" tone="bg-brand-soft text-brand" />
          <Stat value={stats.sold} label="Sold through Nilayam" tone="bg-accent-soft text-[var(--accent-strong)]" />
        </div>
      )}

      {founders.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {founders.map((f) => (
            <div key={f.name} className="flex items-center gap-2.5">
              {f.photo ? (
                <img src={mediaUrl(f.photo)} alt={f.name} className="h-11 w-11 rounded-full object-cover ring-2 ring-surface" />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft font-semibold text-brand">{f.name[0]}</span>
              )}
              <div className="leading-tight">
                <p className="text-sm font-semibold">{f.name}</p>
                {f.role && <p className="text-xs text-sub">{f.role}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {office && (
        <p className="flex items-center gap-1.5 text-sm text-sub">
          <MapPin size={15} className="text-brand" /> Office: {office}
        </p>
      )}

      {testimonials.length > 0 && (
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
          {testimonials.map((t) => (
            <figure key={t.name + t.quote} className="w-64 shrink-0 rounded-[20px] bg-muted p-4">
              <Quote size={18} className="text-[var(--accent-strong)]" />
              <blockquote className="mt-1 text-sm">{t.quote}</blockquote>
              <figcaption className="mt-2 text-xs font-semibold text-sub">
                {t.name}
                {t.place && `, ${t.place}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={cn("rounded-[20px] p-3 text-center", tone)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

/** Familiar floating WhatsApp button (bottom right, above the nav). */
export function FloatingWhatsApp({ contact }: { contact: Contact }) {
  return (
    <a
      href={waLink(contact)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Nilayam on WhatsApp"
      className="fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+76px)] z-40 grid h-14 w-14 place-items-center rounded-full bg-wa text-white shadow-float transition active:scale-95"
    >
      <MessageCircle size={26} />
    </a>
  );
}
