import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[28px]"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-muted">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
