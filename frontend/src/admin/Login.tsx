import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) setError("Wrong email or password");
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[32px] bg-surface p-7 shadow-card">
        <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Lock size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Nilayam admin</h1>
          <p className="text-sm text-sub">Founders only.</p>
        </div>
        {!supabase ? (
          <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable admin login.
          </p>
        ) : (
          <>
            <Field label="Email">
              <Input name="email" type="email" required autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" required autoComplete="current-password" />
            </Field>
            {error && <p className="text-sm font-medium text-sold">{error}</p>}
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
