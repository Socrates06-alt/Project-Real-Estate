import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Languages, RotateCw } from "lucide-react";
import { useAsync } from "@/shared/lib/useAsync";
import { Input, Textarea } from "@/shared/ui/field";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { Checkbox } from "@/shared/components/form/Checkbox";
import { useAdmin } from "@/features/admin/auth";

/**
 * TEMPORARY one-time tool: fix spelling, translate Malayalam and rewrite every live listing's text into good
 * English (Sarvam AI). Review before -> after, then apply. Remove this page and its Inbox button when done.
 */
type Fields = { title: string; location: string; description: string; documents_note: string };
type Item = { id: string; number: number; status: "waiting" | "working" | "ready" | "error" | "applied"; before?: Fields; after?: Fields; error?: string; pick?: boolean };
const LABELS: [keyof Fields, string][] = [
  ["title", "Title"],
  ["location", "Location"],
  ["description", "Description"],
  ["documents_note", "Documents"],
];
const changed = (i: Item) => !!i.before && !!i.after && LABELS.some(([k]) => i.before![k] !== i.after![k]);

export default function Cleanup() {
  const { call } = useAdmin();
  const nav = useNavigate();
  const toast = useToast();
  const { data } = useAsync(() => call<{ enabled: boolean; listings: { id: string; number: number }[] }>("/cleanup"), []);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);

  const update = (id: string, patch: Partial<Item>) => setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function previewOne(id: string) {
    update(id, { status: "working", error: undefined });
    try {
      const r = await call<{ before: Fields; after: Fields }>(`/cleanup/${id}/preview`, { method: "POST" });
      update(id, { status: "ready", before: r.before, after: r.after, pick: LABELS.some(([k]) => r.before[k] !== r.after[k]) });
    } catch (e) {
      update(id, { status: "error", error: (e as Error).message });
    }
  }

  async function start() {
    if (!data) return;
    const list: Item[] = data.listings.map((l) => ({ id: l.id, number: l.number, status: "waiting" }));
    setItems(list);
    setRunning(true);
    for (const l of list) await previewOne(l.id); // one at a time: gentle on the AI service
    setRunning(false);
  }

  async function applyAll() {
    const chosen = items.filter((i) => i.status === "ready" && i.pick && changed(i));
    if (!chosen.length || !window.confirm(`Update ${chosen.length} listing(s)? Buyers will see the new text.`)) return;
    setApplying(true);
    let done = 0;
    for (const i of chosen) {
      try {
        await call(`/cleanup/${i.id}/apply`, { method: "POST", body: i.after });
        update(i.id, { status: "applied" });
        done++;
      } catch (e) {
        update(i.id, { status: "error", error: (e as Error).message });
      }
    }
    setApplying(false);
    toast(`${done} listing(s) updated`);
  }

  const total = items.length;
  const finished = items.filter((i) => i.status !== "waiting" && i.status !== "working").length;
  const toApply = items.filter((i) => i.status === "ready" && i.pick && changed(i)).length;

  return (
    <div className="space-y-4 pb-28">
      <header className="flex items-center gap-2">
        <button onClick={() => nav("/admin")} aria-label="Back" className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Clean up to English</h1>
          <p className="text-xs text-sub">One-time: spelling, Malayalam → English, better sentences</p>
        </div>
      </header>

      {!data && <div className="h-32 shimmer rounded-[28px]" />}
      {data && !data.enabled && (
        <div className="card p-5 text-[15px]">
          <p className="font-semibold">Add the Sarvam key first</p>
          <p className="mt-1 text-sub">
            On the server, add <code>SARVAM_API_KEY=…</code> to <code>/opt/landfinder/backend/.env</code>, then run{" "}
            <code>sudo systemctl restart landfinder</code> and open this page again.
          </p>
        </div>
      )}
      {data?.enabled && !total && (
        <div className="card p-5">
          <p className="text-[15px]">
            Cleans the <b>title, location, description and documents note</b> of all <b>{data.listings.length}</b> live listings. Nothing changes until you
            review and tap Apply. Price, size, photos and area stay the same.
          </p>
          <Button size="lg" className="mt-4" onClick={start} disabled={!data.listings.length}>
            <Languages size={18} /> Start clean-up
          </Button>
        </div>
      )}

      {total > 0 && (
        <p className="px-1 text-sm text-sub">
          {running ? `Cleaning ${finished + 1 > total ? total : finished + 1} of ${total}…` : `${finished} of ${total} checked`}
          {!running && ` · ${toApply} ready to apply`}
        </p>
      )}

      {items.map((i) => (
        <section key={i.id} className="card p-4">
          <div className="flex items-center gap-3">
            {i.status === "ready" && changed(i) && (
              <Checkbox checked={!!i.pick} onChange={(v) => update(i.id, { pick: v })} label={`Apply #${i.number}`} className="border-line" />
            )}
            <p className="flex-1 font-semibold">#{i.number}</p>
            <span className="text-xs text-sub">
              {i.status === "waiting" && "Waiting"}
              {i.status === "working" && "Cleaning…"}
              {i.status === "ready" && (changed(i) ? "Ready" : "Already good")}
              {i.status === "applied" && (
                <span className="flex items-center gap-1 font-semibold text-verified">
                  <Check size={14} /> Updated
                </span>
              )}
            </span>
          </div>

          {i.status === "error" && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-sold/10 px-3 py-2 text-sm text-sold">
              <span className="min-w-0">{i.error}</span>
              <button onClick={() => previewOne(i.id)} className="flex shrink-0 items-center gap-1 font-semibold">
                <RotateCw size={14} /> Retry
              </button>
            </div>
          )}

          {i.before && i.after && i.status !== "applied" && changed(i) && (
            <div className="mt-3 space-y-3">
              {LABELS.filter(([k]) => i.before![k] !== i.after![k]).map(([k, label]) => (
                <div key={k}>
                  <p className="mb-1 text-xs font-semibold text-sub">{label}</p>
                  <p className="mb-1.5 rounded-xl bg-muted/60 px-3 py-2 text-sm whitespace-pre-line text-sub line-through decoration-sub/40">{i.before![k] || "—"}</p>
                  {k === "description" ? (
                    <Textarea rows={4} value={i.after![k]} onChange={(e) => update(i.id, { after: { ...i.after!, [k]: e.target.value } })} />
                  ) : (
                    <Input value={i.after![k]} onChange={(e) => update(i.id, { after: { ...i.after!, [k]: e.target.value } })} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {total > 0 && !running && toApply > 0 && (
        <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="glass rounded-full p-1 shadow-float">
            <Button className="h-[52px] min-w-[220px] rounded-full px-8 text-base" disabled={applying} onClick={applyAll}>
              {applying ? "Updating…" : `Apply ${toApply} listing${toApply === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
