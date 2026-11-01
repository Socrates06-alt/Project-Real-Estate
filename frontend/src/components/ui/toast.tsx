import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div role="status" className="animate-fade fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg shadow-float">{msg}</div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
