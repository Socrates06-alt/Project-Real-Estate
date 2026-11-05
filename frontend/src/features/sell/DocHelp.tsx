import { useState } from "react";
import { FileCheck2, Info } from "lucide-react";
import { Sheet } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/components/form/Checkbox";

const DOC_HELP: [string, string][] = [
  ["Sale Agreement & Sale Deed Registration", "Drafting the agreement and registering the sale deed at the Sub-Registrar Office."],
  ["Encumbrance Certificate (EC)", "Shows the property is free of loans, mortgages or legal dues."],
  ["Possession Certificate", "From the Village Office, confirming who holds the property."],
  ["Non-Attachment Certificate", "Confirms the property is not attached by any court or revenue recovery."],
  ["Location Sketch", "Village Office sketch showing the property's location and boundaries."],
];

/** "I need documentation assistance" tick box, with an info sheet listing what's included. */
export function DocHelp({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [info, setInfo] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3.5">
        <Checkbox checked={checked} onChange={onChange} label="I need documentation assistance" className="border-line bg-surface" />
        <button type="button" onClick={() => onChange(!checked)} className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-medium">I need documentation assistance</span>
          <span className="block text-xs text-sub">Special charges apply</span>
        </button>
        <button
          type="button"
          aria-label="What's included"
          onClick={() => setInfo(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
        >
          <Info size={18} />
        </button>
      </div>

      <Sheet open={info} onClose={() => setInfo(false)} title="Documentation assistance">
        <p className="-mt-1 mb-3 text-sm text-sub">We help you prepare and obtain:</p>
        <ul className="divide-y divide-line rounded-2xl bg-muted/60">
          {DOC_HELP.map(([name, what]) => (
            <li key={name} className="flex gap-3 px-4 py-3">
              <FileCheck2 size={18} className="mt-0.5 shrink-0 text-verified" />
              <span>
                <span className="block text-[15px] font-semibold">{name}</span>
                <span className="block text-sm text-sub">{what}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium">Special charges apply for this assistance.</p>
        <Button
          size="lg"
          className="mt-4"
          onClick={() => {
            onChange(true);
            setInfo(false);
          }}
        >
          I need this
        </Button>
      </Sheet>
    </>
  );
}
