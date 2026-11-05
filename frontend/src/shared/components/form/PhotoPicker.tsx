import { useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { FormCard } from "@/shared/components/form/FormCard";

export const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
export type PickedPhoto = { file: File; url: string };

/** Photos card: previews (first is the cover), remove buttons and the "Add photo" tile. */
export function PhotoPicker(props: {
  photos: PickedPhoto[];
  max: number;
  preparing: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (photo: PickedPhoto) => void;
}) {
  const { photos, max, preparing, onAdd, onRemove } = props;
  const picker = useRef<HTMLInputElement>(null);
  return (
    <FormCard title="Photos" hint={`${photos.length}/${max}`}>
      <div className="grid grid-cols-3 gap-2.5">
        {photos.map((p, i) => (
          <div key={p.url} className="relative aspect-square overflow-hidden rounded-2xl">
            <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onRemove(p)}
              className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={preparing}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-sub transition hover:border-brand hover:text-brand"
          >
            {photos.length ? <ImagePlus size={22} /> : <Camera size={22} />}
            <span className="text-xs font-semibold">{preparing ? "Preparing…" : "Add photo"}</span>
          </button>
        )}
      </div>
      <input ref={picker} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => (onAdd(e.target.files), (e.target.value = ""))} />
      <p className="mt-2 text-xs text-sub">Up to {max} clear photos.</p>
    </FormCard>
  );
}
