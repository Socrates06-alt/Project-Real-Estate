import { useState, type FormEvent } from "react";
import type { PropertyType } from "@/shared/api/client";
import { AffixInput, Field, Input, Textarea } from "@/shared/ui/field";
import { Segmented } from "@/shared/ui/segmented";
import { Sheet } from "@/shared/ui/sheet";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { AreaInput, type Area } from "@/shared/components/AreaInput";
import { ExpectedPrice, expectedTotal } from "@/shared/components/form/ExpectedPrice";
import { AssistanceOption } from "@/shared/components/form/AssistanceOption";
import { DEV_HELP, DOC_HELP } from "@/shared/lib/assistance";
import { useAdmin } from "@/features/admin/auth";
import type { Property } from "@/features/admin/types";

/** Correct the seller's details on a property a founder entered (seller-entered originals can't change). */
export function EditSellerSheet({ property, open, onClose, onSaved }: { property: Property; open: boolean; onClose: () => void; onSaved: () => void }) {
  const s = property.seller;
  const { call } = useAdmin();
  const toast = useToast();
  const [type, setType] = useState<PropertyType>(s.property_type);
  const [area, setArea] = useState<Area>({ name: s.location, lat: s.area_lat ?? null, lng: s.area_lng ?? null });
  const [negotiable, setNegotiable] = useState(s.negotiable);
  const [docs, setDocs] = useState(s.documents_available);
  const [docHelp, setDocHelp] = useState(s.wants_doc_help);
  const [devHelp, setDevHelp] = useState(s.wants_dev_help);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await call(`/properties/${property.id}/seller`, {
        method: "PUT",
        body: {
          seller_name: f.get("seller_name"),
          seller_phone: f.get("seller_phone"),
          property_type: type,
          land_area_cents: Number(f.get("land_area_cents")),
          location: area.name,
          area_lat: area.lat,
          area_lng: area.lng,
          address: f.get("address"),
          description: f.get("description"),
          expected_price: expectedTotal(f, type),
          negotiable,
          documents_available: docs,
          documents_note: docs ? f.get("documents_note") ?? "" : "",
          wants_doc_help: docHelp,
          wants_dev_help: devHelp,
        },
      });
      toast("Seller details updated");
      onClose();
      onSaved();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Edit seller details">
      <form onSubmit={save} className="space-y-3.5">
        <Field label="Seller's name">
          <Input name="seller_name" defaultValue={s.seller_name} required minLength={2} maxLength={80} />
        </Field>
        <Field label="Seller's phone">
          <Input name="seller_phone" defaultValue={s.seller_phone} required inputMode="tel" />
        </Field>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "house", label: "House" },
            { value: "land", label: "Land" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
        <Field label="Land size">
          <AffixInput name="land_area_cents" defaultValue={String(s.land_area_cents)} suffix="cents" required inputMode="decimal" pattern="\d+(\.\d{1,2})?" />
        </Field>
        <Field label="Location">
          <AreaInput name="location" required value={area} onChange={setArea} />
        </Field>
        <Field label="Full address (private)">
          <Textarea name="address" defaultValue={s.address} maxLength={300} rows={2} className="min-h-0" />
        </Field>
        <Field label="Description">
          <Textarea name="description" defaultValue={s.description} maxLength={4000} rows={3} className="min-h-0" />
        </Field>
        <ExpectedPrice type={type} defaultTotal={s.expected_price} />
        <Switch checked={negotiable} onChange={setNegotiable} label="Price is negotiable" />
        <Switch checked={docs} onChange={setDocs} label="Legal documents available" />
        {docs && <Input name="documents_note" defaultValue={s.documents_note} maxLength={500} placeholder="e.g. Title deed, tax receipt" />}
        <AssistanceOption inline info={DOC_HELP} checked={docHelp} onChange={setDocHelp} label="Seller wants documentation assistance" />
        <AssistanceOption inline info={DEV_HELP} checked={devHelp} onChange={setDevHelp} label="Seller wants property development assistance" />
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Saving…" : "Save seller details"}
        </Button>
      </form>
    </Sheet>
  );
}
