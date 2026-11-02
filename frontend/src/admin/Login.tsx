import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useAdmin } from "./auth";

export default function Login() {
  const { login } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(String(new FormData(e.currentTarget).get("password")));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 card p-7 shadow-card">
        <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Lock size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">LandFinder admin</h1>
          <p className="text-sm text-sub">Founders only.</p>
        </div>
        <Field label="Password">
          <Input name="password" type="password" required autoFocus autoComplete="current-password" />
        </Field>
        {error && <p className="text-sm font-medium text-sold">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
