import { PhoneInput } from "@/shared/components/form/PhoneInput";
import { useEffect, useState, type FormEvent } from "react";
import {
  Upload,
  Landmark,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import type { PropertyType } from "@/shared/api/client";
import { typeLabel } from "@/shared/lib/format";
import { useAsync } from "@/shared/lib/useAsync";
import { ErrorState } from "@/shared/components/States";
import { Field, Input, Textarea } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Sheet } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { useAdmin } from "@/features/admin/auth";
import { AssistanceOption } from "@/shared/components/form/AssistanceOption";
import { FINANCE_HELP } from "@/shared/lib/assistance";

type Buyer = {
  id: string;
  name: string;
  phones: string[];
  area: string;
  property_type: PropertyType | null;
  notes: string;
  wants_finance_help: boolean;
  updated_at: string;
};
type TypeChoice = PropertyType | "other"; // "other" is saved as no specific type

/** People looking to buy (entered by founders): search, call or WhatsApp, add, edit, delete. */
export default function Buyers() {
  const { call } = useAdmin();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Buyer | "new" | null>(
    params.get("add") ? "new" : null,
  );

  // Opened from the Inbox's "Add buyer": show the form once, then tidy the address bar.
  useEffect(() => {
    if (params.get("add")) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { data, error, reload } = useAsync(
    () => call<Buyer[]>(`/buyers?q=${encodeURIComponent(q)}`),
    [q],
  );

  const [kind, setKind] = useState<"all" | PropertyType>("all");
  const shown =
    kind === "all" ? data : data?.filter((b) => b.property_type === kind);

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  return (
    <div className="space-y-4">
      <header className="brand-header -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-2 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <h1 className="mr-auto text-2xl font-semibold">Buyers</h1>
        <ImportButton onDone={reload} />
        <button
          onClick={() => setEditing("new")}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-[var(--brand-deep)] shadow-sm"
        >
          <Plus size={18} strokeWidth={2.5} /> Add buyer
        </button>
      </header>

      <div className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 shadow-[0_0_0_1px_var(--hairline)]">
        <Search size={18} className="shrink-0 text-sub" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search name, phone, area or notes"
          aria-label="Search buyers"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-sub"
        />
        {input && (
          <button
            aria-label="Clear"
            onClick={() => setInput("")}
            className="text-sub"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
        role="group"
        aria-label="Show buyers who want"
      >
        {(["all", "land", "house", "commercial"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setKind(t)}
            aria-pressed={kind === t}
            className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition ${
              kind === t
                ? "bg-brand text-brand-ink shadow-sm"
                : "bg-surface text-sub shadow-[0_0_0_1px_var(--hairline)]"
            }`}
          >
            {t === "all" ? "All" : typeLabel(t)}
            {data && (
              <span className="ml-1 opacity-70">
                {t === "all"
                  ? data.length
                  : data.filter((b) => b.property_type === t).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error.message} retry={reload} />}
      {!data && !error && <div className="h-32 shimmer rounded-[28px]" />}
      {data && !data.length && q && (
        <div className="card px-6 py-10 text-center text-sub">
          No buyers match your search.
        </div>
      )}
      {shown && !shown.length && data?.length ? (
        <div className="card px-6 py-10 text-center text-sub">
          No {typeLabel(kind as PropertyType).toLowerCase()} buyers.
        </div>
      ) : null}
      {shown?.map((b) => (
        <BuyerCard key={b.id} buyer={b} onEdit={() => setEditing(b)} />
      ))}
      {!!data?.length && !q && <RemoveAllButton onDone={reload} />}

      {editing && (
        <BuyerSheet
          buyer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function BuyerCard({ buyer: b, onEdit }: { buyer: Buyer; onEdit: () => void }) {
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{b.name}</p>
          <p className="text-sm text-sub">
            {b.property_type ? typeLabel(b.property_type) : "Other"}
            {b.area && ` · ${b.area}`}
          </p>
        </div>
        <button
          onClick={onEdit}
          aria-label={`Edit ${b.name}`}
          className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand"
        >
          <Pencil size={13} /> Edit
        </button>
      </div>
      {b.wants_finance_help && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold">
          <Landmark size={13} /> Needs finance help
        </p>
      )}
      {b.notes && (
        <p className="mt-2 text-[15px] whitespace-pre-line">{b.notes}</p>
      )}
      <ul className="mt-3 space-y-2">
        {b.phones.map((ph) => (
          <li key={ph} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
              {ph}
            </span>
            <a
              href={`tel:${ph}`}
              aria-label={`Call ${ph}`}
              className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[0_0_0_1px_var(--hairline)]"
            >
              <Phone size={17} className="text-brand" />
            </a>
            <a
              href={`https://wa.me/${ph.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp ${ph}`}
              className="grid h-10 w-10 place-items-center rounded-full bg-wa text-white"
            >
              <MessageCircle size={17} />
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}


function BuyerSheet({
  buyer,
  onClose,
  onSaved,
}: {
  buyer: Buyer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { call } = useAdmin();
  const toast = useToast();
  const [phones, setPhones] = useState<string[]>(
    buyer?.phones.length ? buyer.phones : [""],
  );
  const [type, setType] = useState<TypeChoice>(buyer?.property_type ?? "other");
  const [finance, setFinance] = useState(buyer?.wants_finance_help ?? false);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get("name"),
      phones: phones.map((p) => p.trim()).filter(Boolean),
      area: f.get("area"),
      property_type: type === "other" ? null : type,
      notes: f.get("notes"),
      wants_finance_help: finance,
    };
    setBusy(true);
    try {
      await call(buyer ? `/buyers/${buyer.id}` : "/buyers", {
        method: buyer ? "PUT" : "POST",
        body,
      });
      toast(buyer ? "Buyer updated" : "Buyer added");
      onSaved();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!buyer || !window.confirm(`Delete ${buyer.name}?`)) return;
    try {
      await call(`/buyers/${buyer.id}`, { method: "DELETE" });
      toast("Buyer deleted");
      onSaved();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <Sheet open onClose={onClose} title={buyer ? "Edit buyer" : "Add buyer"}>
      <form onSubmit={save} className="space-y-3.5">
        <Field label="Name">
          <Input
            name="name"
            defaultValue={buyer?.name}
            required
            minLength={2}
            maxLength={80}
            placeholder="Full name"
          />
        </Field>

        <div>
          <p className="mb-1.5 px-1 text-sm font-medium">Phone numbers</p>
          <div className="space-y-2">
            {phones.map((ph, i) => (
              <div
                key={`${i}-${phones.length}`}
                className="flex items-center gap-2"
              >
                <PhoneInput
                  value={ph}
                  onChange={(v) =>
                    setPhones(phones.map((x, j) => (j === i ? v : x)))
                  }
                  aria-label={`Phone ${i + 1}`}
                />
                {phones.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove phone ${i + 1}`}
                    onClick={() => setPhones(phones.filter((_, j) => j !== i))}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sub"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {phones.length < 5 && (
            <button
              type="button"
              onClick={() => setPhones([...phones, ""])}
              className="mt-2 flex items-center gap-1 px-1 text-sm font-semibold text-brand"
            >
              <Plus size={16} /> Add another number
            </button>
          )}
        </div>

        <Field label="Area they want">
          <Input
            name="area"
            defaultValue={buyer?.area}
            maxLength={120}
            placeholder="e.g. Puliyoor, Mulakuzha"
          />
        </Field>
        <div>
          <p className="mb-1.5 px-1 text-sm font-medium">Looking for</p>
          <Segmented<TypeChoice>
            className="[&>button]:text-[14px]"
            value={type}
            onChange={setType}
            options={[
              { value: "land", label: "Land" },
              { value: "house", label: "House" },
              { value: "commercial", label: "Commercial" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
        <Field label="Description">
          <Textarea
            name="notes"
            defaultValue={buyer?.notes}
            maxLength={2000}
            rows={3}
            className="min-h-0"
            placeholder="Budget, size, road access, when they want to buy…"
          />
        </Field>

        <AssistanceOption
          inline
          info={FINANCE_HELP}
          checked={finance}
          onChange={setFinance}
        />

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Saving…" : buyer ? "Save changes" : "Add buyer"}
        </Button>
        {buyer && (
          <button
            type="button"
            onClick={remove}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-[15px] text-sold"
          >
            <Trash2 size={16} /> Delete buyer
          </button>
        )}
      </form>
    </Sheet>
  );
}

/** Add many buyers at once from a spreadsheet saved as CSV; one property type is chosen for the whole file. */
function ImportButton({ onDone }: { onDone: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TypeChoice>("land");
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await call<{ added: number; skipped: number }>(
        "/buyers/import",
        {
          method: "POST",
          body: {
            csv: await file.text(),
            property_type: type === "other" ? null : type,
          },
        },
      );
      toast(
        `Added ${res.added} buyers${res.skipped ? ` · ${res.skipped} already in the list` : ""}`,
      );
      setOpen(false);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold text-white"
      >
        <Upload size={16} /> Import
      </button>
      {createPortal(
        <Sheet open={open} onClose={() => setOpen(false)} title="Import buyers">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 px-1 text-sm font-medium">
                All buyers in this file want
              </p>
              <Segmented
                value={type}
                onChange={setType}
                options={[
                  { value: "land", label: "Land" },
                  { value: "house", label: "House" },
                  { value: "commercial", label: "Commercial" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
            <label
              className={`flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand font-semibold text-brand-ink ${busy ? "opacity-60" : ""}`}
            >
              <Upload size={18} /> {busy ? "Importing…" : "Choose CSV file"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
          </div>
        </Sheet>,
        document.body,
      )}
    </>
  );
}

/** Delete every buyer, after typing DELETE (can't be undone). */
function RemoveAllButton({ onDone }: { onDone: () => void }) {
  const { call } = useAdmin();
  const toast = useToast();

  async function removeAll() {
    const typed = window.prompt("This deletes EVERY buyer and can't be undone.\nType DELETE to confirm.");
    if (typed?.trim() !== "DELETE") return;
    try {
      const res = await call<{ deleted: number }>("/buyers?confirm=DELETE", { method: "DELETE" });
      toast(`Removed ${res.deleted} buyers`);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <button
      type="button"
      onClick={removeAll}
      className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400"
    >
      <Trash2 size={15} /> Remove all buyers
    </button>
  );
}
