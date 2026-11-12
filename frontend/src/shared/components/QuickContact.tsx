import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, MessageCircle, Phone, PhoneIncoming } from "lucide-react";
import { api, getConfig } from "@/shared/api/client";
import { useAsync } from "@/shared/lib/useAsync";
import { useSubmit } from "@/shared/lib/useSubmit";
import { cameFrom } from "@/shared/lib/source";
import { Sheet } from "@/shared/ui/sheet";
import { Field, Input } from "@/shared/ui/field";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Segmented } from "@/shared/ui/segmented";
import { PhoneInput } from "@/shared/components/form/PhoneInput";
import { telLink, waText } from "@/shared/components/contact";
import { cn } from "@/shared/lib/utils";

type Want = "sell" | "buy";
const WA_TEXT: Record<Want | "any", string> = {
  sell: "Hi LandFinder, I want to sell my property.",
  buy: "Hi LandFinder, I'm looking to buy a property.",
  any: "Hi LandFinder, I'd like to talk to you.",
};

/**
 * For people who'd rather not fill a form: Call, WhatsApp, or leave a name and number.
 * compact: one line ("Prefer to talk? Talk to us") that opens the three options in a sheet.
 */
export function QuickContact({
  want,
  label = "Prefer to talk?",
  compact = false,
  className,
}: {
  want?: Want;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const { data: config } = useAsync(getConfig, []);
  const [options, setOptions] = useState(false);
  const [callBack, setCallBack] = useState(false);
  if (!config) return null;
  const call = telLink(config.contact);
  const wa = waText(config.contact, WA_TEXT[want ?? "any"]);
  const sheets = createPortal(
    <>
      <Sheet open={options} onClose={() => setOptions(false)} title="Talk to us">
        <div className="space-y-2.5">
          <a href={call} className={buttonVariants({ variant: "accent", size: "lg" })}>
            <Phone size={19} /> Call us
          </a>
          <a href={wa} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "wa", size: "lg" })}>
            <MessageCircle size={19} /> WhatsApp us
          </a>
          <button
            type="button"
            onClick={() => {
              setOptions(false);
              setCallBack(true);
            }}
            className={buttonVariants({ variant: "soft", size: "lg" })}
          >
            <PhoneIncoming size={19} /> Call me back
          </button>
        </div>
      </Sheet>
      {/* Outside the page's own form and header (a form can't sit inside another form) */}
      <CallMeBack open={callBack} onClose={() => setCallBack(false)} want={want} />
    </>,
    document.body,
  );

  if (compact)
    return (
      <>
        <button type="button" onClick={() => setOptions(true)} className={cn("flex w-full items-center gap-2 text-left text-sm", className)}>
          <Phone size={15} className="shrink-0 text-brand" />
          <span className="text-sub">{label}</span>
          <span className="font-semibold text-brand">Talk to us</span>
          <ChevronRight size={15} className="ml-auto shrink-0 text-sub" />
        </button>
        {/* a sibling, not inside the button: clicks in the sheet must not reopen it */}
        {sheets}
      </>
    );

  const pill = "flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap";
  return (
    <div className={className}>
      <p className="mb-2 text-sm text-sub">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <a href={call} className={cn(pill, "bg-accent text-accent-ink")}>
          <Phone size={15} className="shrink-0" /> Call
        </a>
        <a href={wa} target="_blank" rel="noreferrer" className={cn(pill, "bg-wa text-white")}>
          <MessageCircle size={15} className="shrink-0" /> WhatsApp
        </a>
        <button type="button" onClick={() => setCallBack(true)} className={cn(pill, "bg-brand-soft text-brand")}>
          <PhoneIncoming size={15} className="shrink-0" /> Call back
        </button>
      </div>
      {sheets}
    </div>
  );
}

function CallMeBack({ open, onClose, want: preset }: { open: boolean; onClose: () => void; want?: Want }) {
  const [want, setWant] = useState<Want>(preset ?? "buy");
  const { sending, done, error, send, reset } = useSubmit();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await send(() =>
      api("/api/callbacks", { body: { name: f.get("name"), phone: f.get("phone"), want, came_from: cameFrom() } }),
    );
  }

  const close = () => {
    onClose();
    setTimeout(reset, 300);
  };

  return (
    <Sheet open={open} onClose={close} title={done ? "Thanks!" : "Call me back"}>
      {done ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
            <Check size={28} strokeWidth={2.5} />
          </div>
          <p className="font-semibold">We'll call you soon.</p>
          <Button className="mt-6" variant="soft" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          <p className="text-sm text-sub">Just your name and number. We'll call you.</p>
          {!preset && (
            <Segmented
              value={want}
              onChange={setWant}
              options={[
                { value: "buy", label: "I want to buy" },
                { value: "sell", label: "I want to sell" },
              ]}
            />
          )}
          <Field label="Name">
            <Input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Full name" />
          </Field>
          <Field label="Phone">
            <PhoneInput name="phone" required autoComplete="tel" />
          </Field>
          {error && <p className="text-sm font-medium text-sold">{error}</p>}
          <Button type="submit" variant="accent" size="lg" disabled={sending}>
            {sending ? "Sending…" : "Call me back"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
