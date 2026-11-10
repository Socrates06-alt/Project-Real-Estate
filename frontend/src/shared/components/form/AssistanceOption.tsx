import { useState } from "react";
import { Info } from "lucide-react";
import type { AssistanceInfo } from "@/shared/lib/assistance";
import { Sheet } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/components/form/Checkbox";

/** The details: highlighted lines, like the brokerage terms. */
function Details({ info }: { info: AssistanceInfo }) {
  return (
    <>
      <p className="mb-2.5 text-sm text-sub">{info.intro}</p>
      <ul className="list-disc space-y-2 pl-5 text-[15px]">
        {info.items.map(([name, what]) => (
          <li key={name}>
            <b>{name}</b>: {what}
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium">{info.footer}</p>
    </>
  );
}

/**
 * Optional paid service: a tick box, with an info button that lists what's included.
 * On a full page the info opens in a sheet; inside a sheet ("inline") it expands below instead.
 */
export function AssistanceOption(props: { info: AssistanceInfo; checked: boolean; onChange: (v: boolean) => void; label?: string; inline?: boolean }) {
  const { info, checked, onChange, inline } = props;
  const label = props.label ?? `I need ${info.title.toLowerCase()}`;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-muted/60">
      <div className="flex items-center gap-3 p-3.5">
        <Checkbox checked={checked} onChange={onChange} label={label} className="border-line bg-surface" />
        <button type="button" onClick={() => onChange(!checked)} className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-medium">{label}</span>
          <span className="block text-xs text-sub">{info.note}</span>
        </button>
        <button
          type="button"
          aria-label={`What's included: ${info.title}`}
          aria-expanded={inline ? open : undefined}
          onClick={() => setOpen(!open)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
        >
          <Info size={18} />
        </button>
      </div>

      {inline ? (
        open && (
          <div className="border-t border-line px-4 pt-3 pb-4">
            <Details info={info} />
          </div>
        )
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} title={info.title}>
          <Details info={info} />
          <Button
            size="lg"
            className="mt-4"
            onClick={() => {
              onChange(true);
              setOpen(false);
            }}
          >
            {info.confirm}
          </Button>
        </Sheet>
      )}
    </div>
  );
}
