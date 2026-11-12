import { Heart } from "lucide-react";
import { t } from "@/shared/i18n";
import { toggleSaved, useSavedIds } from "@/shared/lib/saved";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";

/** ❤️ Save / unsave a property on this phone. */
export function SaveButton({ id, className, label = false }: { id: string; className?: string; label?: boolean }) {
  const saved = useSavedIds().includes(id);
  const toast = useToast();
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t("saved.remove") : t("saved.add")}
      onClick={(e) => {
        e.stopPropagation();
        toggleSaved(id);
        toast(saved ? t("saved.removed") : t("saved.added"));
      }}
      className={cn(
        "pointer-events-auto flex h-11 items-center justify-center gap-2 rounded-full bg-white/95 text-ink shadow-md backdrop-blur transition active:scale-90",
        label ? "px-4 text-[15px] font-semibold" : "w-11",
        className,
      )}
    >
      <Heart size={20} strokeWidth={2.4} className={saved ? "fill-red-500 text-red-500" : "text-brand"} />
      {label && (saved ? t("saved.savedLabel") : t("saved.saveLabel"))}
    </button>
  );
}
