import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";

const KEY = "nilayam.admin";

type Ctx = {
  token: string | null;
  login: (password: string) => Promise<void>;
  call: <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>;
  signOut: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Prototype admin auth: one password -> signed token from the backend. */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(stored);

  const save = (t: string | null) => {
    setToken(t);
    try {
      if (t) localStorage.setItem(KEY, t);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  };

  const signOut = useCallback(() => save(null), []);

  const login = useCallback(async (password: string) => {
    const res = await api<{ token: string }>("/api/admin/login", { body: { password } });
    save(res.token);
  }, []);

  const call = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => {
      try {
        return await api<T>(`/api/admin${path}`, { ...opts, token: stored() });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) signOut();
        throw e;
      }
    },
    [signOut],
  );

  return <AuthCtx.Provider value={{ token, login, call, signOut }}>{children}</AuthCtx.Provider>;
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
