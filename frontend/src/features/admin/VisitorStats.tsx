import { Users } from "lucide-react";
import { useAsync } from "@/shared/lib/useAsync";
import { useAdmin } from "@/features/admin/auth";
import { sourceLabel } from "@/shared/lib/source";

type Stats = {
  today: number;
  last_7_days: number;
  last_30_days: number;
  views_30_days: number;
  series: { day: string; visitors: number; views: number }[];
  months: { month: string; visitors: number; views: number }[];
  sources: { source: string; visitors: number; requirements: number; visits: number }[];
  top_properties: { listing_id: string; property_id: string; number: number; title: string | null; location: string | null; views: number }[];
};

const n = (v: number) => v.toLocaleString("en-IN");
/** "2026-11" → "Nov 2026" */
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

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

      {data.sources.length > 0 && (
        <details className="mt-3 border-t border-line pt-2">
          <summary className="cursor-pointer text-sm font-medium text-brand">Where they came from · 30 days</summary>
          <table className="mt-1 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-sub">
                <th className="py-1 font-medium">Source</th>
                <th className="py-1 text-right font-medium">Visitors</th>
                <th className="py-1 text-right font-medium">Requirements</th>
                <th className="py-1 text-right font-medium">Visit req.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.sources.map((s) => (
                <tr key={s.source} className={s.source === "before" ? "text-sub" : undefined}>
                  <td className="py-1.5">{sourceLabel(s.source)}</td>
                  <td className="py-1.5 text-right font-semibold">{n(s.visitors)}</td>
                  <td className="py-1.5 text-right">{n(s.requirements)}</td>
                  <td className="py-1.5 text-right">{n(s.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {data.months.length > 0 && (
        <details className="mt-3 border-t border-line pt-2">
          <summary className="cursor-pointer text-sm font-medium text-brand">By month</summary>
          <ul className="mt-1 divide-y divide-line text-sm">
            {data.months.map((m) => (
              <li key={m.month} className="flex justify-between py-1.5">
                <span>{monthName(m.month)}</span>
                <span className="text-sub">
                  <b className="font-semibold text-ink">{n(m.visitors)}</b> visitors · {n(m.views)} views
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
