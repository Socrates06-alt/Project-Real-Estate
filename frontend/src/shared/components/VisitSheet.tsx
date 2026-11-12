import { t } from "@/shared/i18n";
import { type FormEvent } from "react";
import { useSubmit } from "@/shared/lib/useSubmit";
import { cameFrom } from "@/shared/lib/source";
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
          came_from: cameFrom(),
        },
      }),
    );
  }

  const close = () => {
    onClose();
    setTimeout(reset, 300);
  };

  return (
    <Sheet open={open} onClose={close} title={done ? t("visit.sent") : t("visit.title")}>
      {done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-brand" size={56} />
          <p className="font-semibold">{t("visit.waMessage")}</p>
          <p className="mt-1 text-sm text-sub">{t("visit.comeWith")}</p>
          <Button size="lg" className="mt-6" onClick={close}>
            {t("common.done")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="-mt-2 text-sm text-sub">{t("visit.intro")}</p>
          <Field label={t("visit.yourName")}>
            <Input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder={t("visit.namePh")} />
          </Field>
          <Field label={t("common.phone")}>
            <Input name="phone" required inputMode="tel" autoComplete="tel" placeholder={t("visit.phonePh")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("visit.time")}>
              <Input name="when" maxLength={120} placeholder={t("visit.timePh")} />
            </Field>
            <Field label={t("common.budget")}>
              <Input name="budget" maxLength={60} placeholder="₹50–60 L" />
            </Field>
          </div>
          {error && <p className="rounded-2xl bg-sold/10 px-4 py-3 text-sm text-sold">{error}</p>}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? t("common.sending") : t("visit.send")}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
