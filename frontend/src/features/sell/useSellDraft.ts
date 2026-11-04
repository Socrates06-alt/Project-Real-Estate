import { useEffect, useRef, useState, type RefObject } from "react";
import { clearDraft, loadDraft, saveDraft, type SellDraft } from "./draft";

/**
 * Remembers the unfinished Sell form on this phone: restores it once on open, saves while the seller
 * types or changes choices, and saves straight away when they leave the page or switch apps.
 */
export function useSellDraft<S extends Record<string, unknown>>(opts: {
  formRef: RefObject<HTMLFormElement | null>;
  textFields: string[];
  state: S; // choices outside the typed fields (type, switches, area...)
  photos: { file: File }[];
  disabled: boolean; // e.g. after a successful submit
  onRestore: (draft: SellDraft) => void;
}) {
  const { formRef, textFields, state, photos, disabled, onRestore } = opts;
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0); // bumped to re-render typed fields with restored values
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typed = useRef<Record<string, string>>({}); // latest typed values (kept even after leaving the page)
  const flush = useRef<() => void>(() => {});

  useEffect(() => {
    loadDraft().then((d) => {
      if (d) {
        onRestore(d);
        setSaved(d.fields);
        typed.current = { ...d.fields };
        setFormKey((k) => k + 1);
        if (Object.values(d.fields).some(Boolean) || d.photos.length) setRestored(true);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist() {
    if (!loaded || disabled) return;
    saveDraft({ fields: { ...typed.current }, state, photos: photos.map((p) => p.file) });
  }

  function persistSoon() {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 600);
  }

  /** Form onInput: note the typed values, then save shortly. */
  function onTyping() {
    const form = formRef.current;
    if (form) {
      const fd = new FormData(form);
      for (const k of textFields) if (fd.has(k)) typed.current[k] = String(fd.get(k));
    }
    persistSoon();
  }

  // Save when choices/photos change, and straight away when the seller leaves the page or switches apps.
  useEffect(persistSoon, [...Object.values(state), photos, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  flush.current = () => {
    if (saveTimer.current) persist();
    clearTimeout(saveTimer.current);
  };
  // Leaving for another page (e.g. Terms): save straight away.
  useEffect(() => () => flush.current(), []);
  useEffect(() => {
    const now = () => document.visibilityState === "hidden" && persist();
    document.addEventListener("visibilitychange", now);
    return () => document.removeEventListener("visibilitychange", now);
  });

  /** "Start over": forget the draft and let the page reset its own choices. */
  async function startOver(resetChoices: () => void) {
    clearTimeout(saveTimer.current);
    await clearDraft();
    resetChoices();
    setSaved({});
    typed.current = {};
    setFormKey((k) => k + 1);
    setRestored(false);
  }

  /** After a successful submit: stop saving and forget the draft. */
  async function discard() {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    await clearDraft();
  }

  return { saved, formKey, restored, onTyping, startOver, discard };
}
