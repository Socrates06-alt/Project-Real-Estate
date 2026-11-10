import { type FormEvent } from "react";
import { useSubmit } from "@/shared/lib/useSubmit";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/shared/api/client";
import { Sheet } from "@/shared/ui/sheet";
import { Field, Input } from "@/shared/ui/field";
import { Button } from "@/shared/ui/button";

export function VisitSheet({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const { sending: busy, done, error, send, reset } = useSubmit();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await send(() =>
      api(`/api/listings/${listingId}/visit-requests`, {
        body: {
          name: f.get("name"),
          phone: f.get("phone"),
          preferred_time: f.get("when"),
          budget: f.get("budget"),
        },
      }),
    );
  }

  const close = () => {
    onClose();
    setTimeout(reset, 300);
  };

  return (
    <Sheet open={open} onClose={close} title={done ? "Request sent" : "Request a visit"}>
      {done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-brand" size={56} />
          <p className="font-semibold">We'll message you on WhatsApp</p>
          <p className="mt-1 text-sm text-sub">We fix a time and come with you.</p>
          <Button size="lg" className="mt-6" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="-mt-2 text-sm text-sub">We confirm on WhatsApp and join every visit.</p>
          <Field label="Your name">
            <Input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Your full name" />
          </Field>
          <Field label="Phone">
            <Input name="phone" required inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preferred time">
              <Input name="when" maxLength={120} placeholder="Sat morning" />
            </Field>
            <Field label="Budget">
              <Input name="budget" maxLength={60} placeholder="₹50–60 L" />
            </Field>
          </div>
          {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm text-sold">{error}</p>}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
