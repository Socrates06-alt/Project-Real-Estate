import { useState } from "react";
import { Info } from "lucide-react";
import type { AssistanceInfo } from "@/shared/lib/assistance";
import { Sheet } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Toggle } from "@/shared/ui/switch";

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
 * Optional paid service: a toggle row; the ⓘ on the left opens what's included (in a sheet on pages, or expanded
 * below when already inside a sheet). The toggle switches it on or off.
 */
export function AssistanceOption(props: { info: AssistanceInfo; checked: boolean; onChange: (v: boolean) => void; label?: string; inline?: boolean }) {
  const { info, checked, onChange, inline } = props;
  const label = props.label ?? info.title;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-muted/60">
      <div className="flex items-center justify-between gap-4 py-3.5 pr-4 pl-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={inline ? open : undefined}
            aria-label={`${label}: info`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brand active:bg-brand-soft"
          >
            <Info size={19} />
          </button>
          <span className="min-w-0 text-[15px] font-medium">{label}</span>
        </div>
        <Toggle checked={checked} onChange={onChange} label={label} />
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
