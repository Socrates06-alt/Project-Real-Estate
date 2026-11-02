import { Heart } from "lucide-react";
import { toggleSaved, useSavedIds } from "@/lib/saved";
import { useToast } from "./ui/toast";
import { cn } from "@/lib/utils";

/** Heart: save a property to the shortlist on this phone. */
export function SaveButton({ id, className }: { id: string; className?: string }) {
  const saved = useSavedIds().includes(id);
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save property"}
      aria-pressed={saved}
      onClick={(e) => {
        e.stopPropagation();
        toast(toggleSaved(id) ? "Saved" : "Removed from saved");
      }}
      className={cn("grid h-10 w-10 place-items-center rounded-full bg-white/92 shadow-sm transition active:scale-90", className)}
    >
      <Heart size={19} className={saved ? "fill-[#e5484d] text-[#e5484d]" : "text-[#1a1d29]"} />
    </button>
  );
}
