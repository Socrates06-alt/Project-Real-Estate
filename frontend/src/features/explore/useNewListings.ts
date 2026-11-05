import { useEffect, useRef, useState } from "react";
import type { Feed } from "@/shared/api/client";

const CHECK_EVERY_MS = 3 * 60 * 1000; // while the page is open
const AWAY_MS = 60 * 1000; // coming back to the app after at least this long -> check straight away
const NEAR_TOP_PX = 150;

// What a buyer sees on the first page: which listings, and their versions (so edits count too).
const signature = (f: Feed) => `${f.total}|${f.items.map((l) => `${l.id}:${l.version}`).join(",")}`;

/**
 * Keeps the home feed fresh. Checks for new or updated properties every few minutes while the page is
 * open, and right away when the buyer returns to the app. At the top of the page it refreshes quietly;
 * further down it shows a "New properties" pill so the list doesn't jump while they're reading.
 */
export function useNewListings(current: Feed | undefined, check: () => Promise<Feed>, refresh: () => void) {
  const [hasNew, setHasNew] = useState(false);
  const latest = useRef({ current, check, refresh });
  latest.current = { current, check, refresh };

  // A fresh list arrived (search, filter, refresh): nothing new to announce.
  useEffect(() => setHasNew(false), [current]);

  useEffect(() => {
    let hiddenAt = 0;
    let busy = false;

    async function run() {
      const { current, check, refresh } = latest.current;
      if (!current || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const fresh = await check();
        if (signature(fresh) === signature(current)) return;
        if (window.scrollY < NEAR_TOP_PX) refresh();
        else setHasNew(true);
      } catch {
        /* offline or busy: try again next time */
      } finally {
        busy = false;
      }
    }

    const timer = setInterval(run, CHECK_EVERY_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /** "New properties" tapped: load them and go to the top. */
  function showNew() {
    setHasNew(false);
    latest.current.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return { hasNew, showNew };
}
