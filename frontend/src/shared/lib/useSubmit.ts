import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/shared/api/client";

/**
 * A form's send step as one explicit state machine:
 *
 *   idle ──send──▶ sending ──ok──▶ done
 *                     └──fails──▶ error ──send again──▶ sending
 *
 * Replaces separate busy / error / sent flags (which could disagree). A second tap while sending is
 * ignored, so a quick double tap on a phone can't send a form twice.
 */
export type SubmitState = "idle" | "sending" | "done" | "error";

export function useSubmit() {
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const send = useCallback(async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined; // already sending
    inFlight.current = true;
    setState("sending");
    setError(null);
    try {
      const result = await work();
      setState("done");
      return result;
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message || "Something went wrong" : "Something went wrong");
      setState("error");
      return undefined;
    } finally {
      inFlight.current = false;
    }
  }, []);

  /** Show a problem found before sending (e.g. "Please accept the terms"). */
  const fail = useCallback((message: string) => {
    setError(message);
    setState("error");
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setState("idle");
  }, []);

  return { state, sending: state === "sending", done: state === "done", error, send, fail, reset };
}
