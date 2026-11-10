import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useToast } from "@/shared/ui/toast";
import { useAdmin } from "@/features/admin/auth";

export type RephraseFields = { title?: string; location?: string; description?: string; documents_note?: string };

/** Rewrites the typed text in simple English (Malayalam translated, spelling and capitals fixed). Nothing is saved. */
export function RephraseButton({ get, onDone }: { get: () => RephraseFields; onDone: (f: Required<RephraseFields>) => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    const fields = get();
    if (!fields.description?.trim() && !fields.title?.trim()) return toast("Type a description first");
    setBusy(true);
    try {
      const res = await call<Required<RephraseFields>>("/rephrase", { method: "POST", body: fields });
      onDone(res);
      toast("Rephrased. Check it, then save.");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="flex h-10 items-center gap-1.5 rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand disabled:opacity-60"
    >
      <Sparkles size={16} /> {busy ? "Rephrasing… (up to a minute)" : "Rephrase in English"}
    </button>
  );
}
