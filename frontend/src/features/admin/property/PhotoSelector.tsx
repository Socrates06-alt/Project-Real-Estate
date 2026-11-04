import { Eye, EyeOff, ImagePlus } from "lucide-react";
import type { PropertyType } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";
import { PrivatePhoto } from "@/features/admin/ui";

/** Choose which photos buyers see (tap to show/hide), and add photos when the seller sent none. */
export function PhotoSelector(props: {
  photos: { id: string; url: string }[];
  selected: string[];
  type: PropertyType;
  readOnly: boolean;
  uploading: boolean;
  onToggle: (id: string) => void;
  onAdd: (files: FileList | null) => void;
}) {
  const { photos, selected, type, readOnly, uploading, onToggle, onAdd } = props;
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">Photos</p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((ph) => {
          const on = selected.includes(ph.id);
          return (
            <button key={ph.id} type="button" onClick={() => onToggle(ph.id)} className="relative">
              <PrivatePhoto url={ph.url} type={type} className={cn("aspect-square rounded-2xl transition", !on && "opacity-30 grayscale")} />
              <span className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white">
                {on ? <Eye size={14} /> : <EyeOff size={14} />}
              </span>
            </button>
          );
        })}
        {!readOnly && photos.length < 3 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-sub transition hover:border-brand hover:text-brand">
            <ImagePlus size={22} />
            <span className="text-xs font-semibold">{uploading ? "Adding…" : "Add photo"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={uploading} onChange={(e) => (onAdd(e.target.files), (e.target.value = ""))} />
          </label>
        )}
      </div>
      {!photos.length && <p className="mt-1.5 text-xs text-sub">No photos yet. Add some so buyers can see the property.</p>}
    </div>
  );
}
