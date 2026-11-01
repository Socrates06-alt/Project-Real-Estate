import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, SearchX, X } from "lucide-react";
import { api, getConfig, type Feed, type Listing, type Parsed } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAsync } from "@/lib/useAsync";
import { ListingCard, ListingCardSkeleton } from "@/components/ListingCard";
import { EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";

type TypeFilter = "all" | "house" | "land";
type StatusFilter = "live" | "sold";
const PAGE = 10;

export default function Explore() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("live");
  const [extra, setExtra] = useState<Listing[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const query = (offset: number) => {
    const p = new URLSearchParams({ q, status, limit: String(PAGE), offset: String(offset) });
    if (type !== "all") p.set("type", type);
    return api<Feed>(`/api/listings?${p}`);
  };

  const { data, error, loading, reload } = useAsync(async () => {
    const feed = await query(0);
    setExtra([]);
    setHasMore(feed.has_more);
    return feed;
  }, [q, type, status]);
  const config = useAsync(getConfig, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await query(PAGE + extra.length);
      setExtra((e) => [...e, ...next.items]);
      setHasMore(next.has_more);
    } finally {
      setLoadingMore(false);
    }
  }

  const items = [...(data?.items ?? []), ...extra];
  const contact = data?.contact ?? config.data?.contact;

  return (
    <div>
      <header className="sticky top-0 z-30 -mx-4 bg-bg/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[26px] font-extrabold tracking-tight">
            nilayam<span className="text-brand">.</span>
          </h1>
          <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-sub shadow-card">Chengannur</span>
        </div>
        <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-surface px-4 shadow-card focus-within:ring-4 focus-within:ring-brand/15">
          <Search size={19} className="shrink-0 text-sub" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "land under 40 lakh Puliyoor"'
            aria-label="Search properties"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-sub/70"
          />
          {input && (
            <button aria-label="Clear search" onClick={() => setInput("")} className="grid h-7 w-7 place-items-center rounded-full bg-muted">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto">
          {(["all", "house", "land"] as const).map((t) => (
            <Chip key={t} on={type === t} onClick={() => setType(t)}>
              {t === "all" ? "All" : t === "house" ? "Houses" : "Land"}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          <Chip on={status === "live"} onClick={() => setStatus("live")}>
            Available
          </Chip>
          <Chip on={status === "sold"} onClick={() => setStatus("sold")}>
            Sold
          </Chip>
        </div>
        {data && <ParsedChips parsed={data.parsed} />}
      </header>

      <div className="space-y-5 pt-2">
        {!q && status === "live" && type === "all" && <SellBanner />}
        {loading && !data && [0, 1].map((i) => <ListingCardSkeleton key={i} />)}
        {error && <ErrorState message={error.message} retry={reload} />}
        {data && contact && items.map((l) => <ListingCard key={l.id} listing={l} contact={contact} />)}
        {data && !items.length && (
          <EmptyState
            icon={<SearchX size={28} />}
            title={status === "sold" ? "No sold properties yet" : "Nothing matches yet"}
            text="Try a nearby area or a wider budget. New properties are added every week."
          />
        )}
        {hasMore && (
          <Button variant="outline" size="lg" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Loading…" : "Show more"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
        on ? "bg-ink text-bg" : "bg-surface text-sub shadow-card hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ParsedChips({ parsed }: { parsed: Parsed }) {
  const chips = [
    parsed.max_price && `Under ${inr(parsed.max_price)}`,
    parsed.min_price && `Above ${inr(parsed.min_price)}`,
    parsed.min_cents && `${parsed.min_cents}+ cents`,
    parsed.max_cents && `Up to ${parsed.max_cents} cents`,
    parsed.text && `“${parsed.text}”`,
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-sub">Searching</span>
      {chips.map((c) => (
        <span key={c as string} className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand">
          {c}
        </span>
      ))}
    </div>
  );
}

function SellBanner() {
  return (
    <Link
      to="/sell"
      className="flex items-center gap-4 rounded-[28px] bg-gradient-to-br from-brand to-emerald-500 p-5 text-white shadow-card transition active:scale-[0.99]"
    >
      <div className="flex-1">
        <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">Selling?</p>
        <p className="mt-0.5 text-lg leading-snug font-bold">List your property free. Pay only when it sells.</p>
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20">
        <ArrowRight size={20} />
      </span>
    </Link>
  );
}
