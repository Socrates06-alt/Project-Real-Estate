import { PhoneInput } from "@/shared/components/form/PhoneInput";
import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronDown,
  Upload,
  Landmark,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import type { PropertyType } from "@/shared/api/client";
import { cents, inr, typeLabel } from "@/shared/lib/format";
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
  via?: string; // search only: why it was found ("Matches #1004 (Saraswathy K)")
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

      {error && <ErrorState message={error.message} retry={reload} />}
      {!data && !error && <div className="h-32 shimmer rounded-[28px]" />}
      {data && !data.length && q && (
        <div className="card px-6 py-10 text-center text-sub">
          No buyers match your search.
        </div>
      )}
      {data?.map((b) => (
        <BuyerCard key={b.id} buyer={b} onEdit={() => setEditing(b)} />
      ))}

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
      {b.via && <p className="mt-1 text-sm font-medium text-brand">{b.via}</p>}
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
      <MatchingProperties buyerId={b.id} />
    </article>
  );
}

type PropertyMatch = {
  property_id: string;
  number: number;
  property_type: PropertyType;
  location: string;
  land_area_cents: number;
  price: number;
  reasons: string[];
};

/** Live properties that may suit this buyer; loaded when opened. */
function MatchingProperties({ buyerId }: { buyerId: string }) {
  const { call } = useAdmin();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PropertyMatch[] | null>(null);

  async function toggle() {
    setOpen(!open);
    if (!items)
      setItems(
        await call<PropertyMatch[]>(`/buyers/${buyerId}/matches`).catch(
          () => [],
        ),
      );
  }

  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1 text-sm font-semibold text-brand"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles size={15} /> Matching properties
        </span>
        <ChevronDown
          size={17}
          className={open ? "rotate-180 transition" : "transition"}
        />
      </button>
      {open && items === null && (
        <div className="mt-2 h-12 shimmer rounded-2xl" />
      )}
      {open && items?.length === 0 && (
        <p className="mt-1.5 text-sm text-sub">No live properties match yet.</p>
      )}
      {open && !!items?.length && (
        <ul className="mt-2 divide-y divide-line rounded-2xl bg-muted/50">
          {items.map((p) => (
            <li key={p.property_id}>
              <Link
                to={`/admin/p/${p.property_id}`}
                className="block px-3.5 py-2.5 text-sm"
              >
                <span className="flex justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">
                    #{p.number} {typeLabel(p.property_type)} · {p.location}
                  </span>
                  <span className="shrink-0 font-semibold">{inr(p.price)}</span>
                </span>
                <span className="block truncate text-xs text-sub">
                  {cents(p.land_area_cents)} · {p.reasons.join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
            <p className="px-1 text-sm text-sub">
              Choose a spreadsheet saved as CSV (columns: Name, Phone, Other
              phone, Area, Needs).
            </p>
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
