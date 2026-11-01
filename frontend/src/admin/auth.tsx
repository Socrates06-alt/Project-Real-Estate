import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api, ApiError } from "@/lib/api";

type Ctx = {
  session: Session | null;
  ready: boolean;
  call: <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>;
  signOut: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return setReady(true);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(() => {
    supabase?.auth.signOut();
    setSession(null);
  }, []);

  const call = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => {
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      try {
        return await api<T>(`/api/admin${path}`, { ...opts, token: data.session?.access_token });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) signOut();
        throw e;
      }
    },
    [signOut],
  );

  return <AuthCtx.Provider value={{ session, ready, call, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAdmin outside provider");
  return ctx;
}

/** Private photos need the admin token, so fetch them as blobs. */
export function usePrivateImage(path: string) {
  const { call } = useAdmin();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let objectUrl: string | undefined;
    call<Blob>(path.replace(/^\/api\/admin/, "")).then(
      (blob) => setUrl((objectUrl = URL.createObjectURL(blob))),
      () => setUrl(undefined),
    );
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, call]);
  return url;
}
