import { Link } from "react-router-dom";
import { Eye, Users } from "lucide-react";
import { useAsync } from "@/shared/lib/useAsync";
import { useAdmin } from "@/features/admin/auth";

type Stats = {
  today: number;
  last_7_days: number;
  last_30_days: number;
  views_30_days: number;
  series: { day: string; visitors: number; views: number }[];
  top_properties: { listing_id: string; property_id: string; number: number; title: string | null; location: string | null; views: number }[];
};

const n = (v: number) => v.toLocaleString("en-IN");

/** Website visitors (counted privately on our own server) and the most-viewed properties. */
export function VisitorStats() {
  const { call } = useAdmin();
  const { data } = useAsync(() => call<Stats>("/stats"), []);
  if (!data) return <div className="h-48 shimmer rounded-[28px]" />;
  const max = Math.max(1, ...data.series.map((d) => d.visitors));

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Users size={18} className="text-brand" /> Website visitors
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Today", data.today],
          ["7 days", data.last_7_days],
          ["30 days", data.last_30_days],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-muted/70 py-2.5">
            <p className="text-xl font-semibold">{n(value as number)}</p>
            <p className="text-xs text-sub">{label}</p>
          </div>
        ))}
      </div>

      {/* Visitors per day, last 30 days (today on the right) */}
      <div className="mt-4 flex h-16 items-end gap-[3px]" aria-label="Visitors per day, last 30 days">
        {data.series.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.visitors} visitors, ${d.views} page views`}
            className="flex-1 rounded-t-[3px] bg-brand/80"
            style={{ height: `${Math.max(4, (d.visitors / max) * 100)}%`, opacity: d.visitors ? 1 : 0.25 }}
          />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between text-[11px] text-sub">
        <span>30 days ago</span>
        <span>{n(data.views_30_days)} page views</span>
        <span>Today</span>
      </p>

      {data.top_properties.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold">Most viewed properties · 30 days</p>
          <ul className="divide-y divide-line rounded-2xl bg-muted/50">
            {data.top_properties.map((t) => (
              <li key={t.listing_id}>
                <Link to={`/admin/p/${t.property_id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-sub">#{t.number}</span> {t.title || "Property"}
                    {t.location && <span className="text-sub"> · {t.location}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-medium">
                    <Eye size={14} className="text-sub" /> {n(t.views)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-sub">Counted on our own server: no cookies, nothing personal stored. A person counts once per day.</p>
    </section>
  );
}
