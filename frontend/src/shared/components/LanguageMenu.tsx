import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages, X } from "lucide-react";
import { dismissLanguageStrip, languageAsked, setLang, useLang, type Lang } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

const OPTIONS: { lang: Lang; label: string; short: string }[] = [
  { lang: "en", label: "English", short: "EN" },
  { lang: "ml", label: "മലയാളം", short: "മല" },
];

/** Small language dropdown for the top bar ("EN ▾" / "മല ▾"). */
export function LanguageMenu({ className }: { className?: string }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.lang === lang) ?? OPTIONS[0];
  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language"
        className="flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-white/15 pr-2 pl-3 text-sm font-semibold text-white backdrop-blur-sm transition active:scale-95"
      >
        {current.short}
        <ChevronDown size={14} className={cn("opacity-80 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-fade absolute top-12 right-0 z-50 w-40 overflow-hidden rounded-2xl bg-surface p-1 text-ink shadow-float"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.lang}
              type="button"
              role="menuitemradio"
              aria-checked={lang === o.lang}
              onClick={() => {
                setLang(o.lang);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[15px]",
                lang === o.lang ? "bg-brand-soft font-semibold text-brand" : "hover:bg-muted",
              )}
            >
              {o.label}
              {lang === o.lang && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** First visit only: a slim, non-blocking offer of the other language, written in that language. */
export function LanguageStrip() {
  const lang = useLang();
  const [hidden, setHidden] = useState(languageAsked());
  if (hidden) return null;
  const other: Lang = lang === "ml" ? "en" : "ml";
  const close = () => {
    dismissLanguageStrip();
    setHidden(true);
  };
  return (
    <div className="animate-fade mx-auto flex w-fit items-center gap-1 rounded-full bg-surface p-1 shadow-[0_0_0_1px_var(--hairline)]">
      <button
        type="button"
        onClick={() => {
          setLang(other);
          setHidden(true);
        }}
        className="flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink"
      >
        <Languages size={16} />
        {other === "ml" ? "മലയാളം" : "English"}
      </button>
      <button type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sub">
        <X size={17} />
      </button>
    </div>
  );
}
