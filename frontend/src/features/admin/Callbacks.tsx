import { useState } from "react";
import { Check, PhoneIncoming } from "lucide-react";
import { timeAgo } from "@/shared/lib/format";
import { sourceLabel } from "@/shared/lib/source";
import { useAsync } from "@/shared/lib/useAsync";
import { useToast } from "@/shared/ui/toast";
import { useAdmin } from "@/features/admin/auth";
import { ContactButtons } from "@/features/admin/ui";

type Callback = { id: string; name: string; phone: string; want: "sell" | "buy" | ""; came_from: string; created_at: string };
const WANT = { sell: "Wants to sell", buy: "Wants to buy", "": "Not said" };

/** People who left a name and number ("Call me back"): call them, then tick Done. */
export function Callbacks({ onChange }: { onChange: () => void }) {
  const { call } = useAdmin();
  const { data, reload } = useAsync(() => call<Callback[]>("/callbacks"), []);
  if (!data?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 px-1 font-semibold">
        <PhoneIncoming size={17} className="text-brand" /> Call back · {data.length}
      </h2>
      {data.map((c) => (
        <CallbackCard
          key={c.id}
          c={c}
          onDone={() => {
            reload();
            onChange();
          }}
        />
      ))}
    </section>
  );
}

function CallbackCard({ c, onDone }: { c: Callback; onDone: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function done() {
    setBusy(true);
    try {
      await call(`/callbacks/${c.id}/done`, { method: "POST" });
      onDone();
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="card p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="text-sm text-sub">
            {WANT[c.want]} · {timeAgo(c.created_at)} ago
            {c.came_from && ` · from ${sourceLabel(c.came_from)}`}
          </p>
          <p className="text-sm text-sub">{c.phone}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={done}
          className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand"
        >
          <Check size={14} /> Done
        </button>
      </div>
      <ContactButtons phone={c.phone} />
    </div>
  );
}
