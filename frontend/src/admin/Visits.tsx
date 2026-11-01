import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Phone } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { ErrorState } from "@/components/States";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "./auth";
import { FilterChips } from "./ui";
import type { Visit } from "./types";

const STATUSES: Visit["status"][] = ["new", "contacted", "scheduled", "done", "cancelled"];

export default function Visits() {
  const { call } = useAdmin();
  const [filter, setFilter] = useState<"open" | Visit["status"]>("new");
  const { data, error, reload } = useAsync(
    () => call<Visit[]>(`/visits${filter === "open" ? "" : `?status=${filter}`}`),
    [filter],
  );
  const items = filter === "open" ? data?.filter((v) => ["new", "contacted", "scheduled"].includes(v.status)) : data;

  return (
    <>
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[["new", "New"], ["open", "All open"], ["scheduled", "Scheduled"], ["done", "Done"], ["cancelled", "Cancelled"]]}
      />
      {error && <ErrorState message={error.message} retry={reload} />}
      {items && !items.length && <p className="py-10 text-center text-sub">No visit requests</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {items?.map((v) => <VisitCard key={v.id} visit={v} onChange={reload} />)}
      </div>
    </>
  );
}

function VisitCard({ visit, onChange }: { visit: Visit; onChange: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [notes, setNotes] = useState(visit.admin_notes);

  async function update(body: Partial<Pick<Visit, "status" | "admin_notes">>) {
    try {
      await call(`/visits/${visit.id}`, { method: "PATCH", body });
      toast("Saved");
      onChange();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const phone = visit.phone.replace(/\D/g, "");
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{visit.name}</p>
          <p className="text-sm text-sub">{visit.phone}</p>
        </div>
        <div className="flex gap-1.5">
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-9 w-9 place-items-center rounded-full bg-wa text-white">
            <MessageCircle size={17} />
          </a>
          <a href={`tel:${visit.phone}`} aria-label="Call" className="grid h-9 w-9 place-items-center rounded-full bg-muted">
            <Phone size={16} />
          </a>
        </div>
      </div>
      <Link to={`/p/${visit.listing_id}`} target="_blank" className="mt-3 block truncate rounded-2xl bg-muted px-3 py-2 text-sm">
        <span className="font-mono text-sub">#{visit.listing_number}</span> {visit.listing_title}
      </Link>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-sub">When</dt>
          <dd className="font-medium">{visit.preferred_time || "Any time"}</dd>
        </div>
        <div>
          <dt className="text-xs text-sub">Budget</dt>
          <dd className="font-medium">{visit.budget || "—"}</dd>
        </div>
      </dl>
      <div className="mt-3 flex gap-2">
        <select
          value={visit.status}
          onChange={(e) => update({ status: e.target.value as Visit["status"] })}
          className="h-10 rounded-full border border-line bg-muted px-3 text-sm font-semibold capitalize"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== visit.admin_notes && update({ admin_notes: notes })}
          placeholder="Notes…"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-muted px-4 text-sm outline-none focus:border-brand"
        />
      </div>
      <p className="mt-2 text-right text-xs text-sub">{timeAgo(visit.created_at)} ago</p>
    </div>
  );
}
