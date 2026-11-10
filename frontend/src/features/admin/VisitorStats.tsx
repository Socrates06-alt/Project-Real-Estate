import { Users } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users size={16} className="text-brand" /> Visitors
        </h2>
        <p className="text-xs text-sub">{n(data.views_30_days)} page views · 30 days</p>
      </div>
      <div className="mt-2 grid grid-cols-3 text-center">
        {[
          ["Today", data.today],
          ["7 days", data.last_7_days],
          ["30 days", data.last_30_days],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xl font-semibold">{n(value as number)}</p>
            <p className="text-[11px] text-sub">{label}</p>
          </div>
        ))}
      </div>

      {/* Visitors per day, last 30 days (today on the right) */}
      <div className="mt-3 flex h-10 items-end gap-[3px]" aria-label="Visitors per day, last 30 days">
        {data.series.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.visitors} visitors, ${d.views} page views`}
            className="flex-1 rounded-t-[3px] bg-brand/80"
            style={{ height: `${Math.max(6, (d.visitors / max) * 100)}%`, opacity: d.visitors ? 1 : 0.2 }}
          />
        ))}
      </div>

    </section>
  );
}
