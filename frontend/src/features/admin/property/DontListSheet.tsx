import { useState } from "react";
import { Sheet } from "@/shared/ui/sheet";
import { Field, Input } from "@/shared/ui/field";
import { Button } from "@/shared/ui/button";

/** Confirm not listing a new property, with an optional reason. */
export function DontListSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Don't list this property?">
      <p className="mb-3 text-sm text-sub">The seller's details stay saved. You can still publish it later.</p>
      <Field label="Reason (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Outside our area" />
      </Field>
      <Button size="lg" className="mt-5" onClick={() => onConfirm(note)}>
        Don't list
      </Button>
    </Sheet>
  );
}
