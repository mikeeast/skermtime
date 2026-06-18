"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError("Google-inloggning är inte aktiverad än — lägg till OAuth-nycklar.");
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold">Skermtime</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tjäna skärmtid med löprundor och sysslor.
        </p>
      </div>

      <button
        onClick={signInWithGoogle}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border font-medium transition hover:bg-muted"
      >
        Fortsätt med Google
      </button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        eller
        <span className="h-px flex-1 bg-border" />
      </div>

      {sent ? (
        <p className="rounded-xl bg-emerald-500/10 p-4 text-center text-sm text-emerald-700 dark:text-emerald-300">
          Kolla mejlen för inloggningslänken. Lokalt fångas den i Mailpit:{" "}
          <a className="underline" href="http://127.0.0.1:54424" target="_blank" rel="noreferrer">
            127.0.0.1:54424
          </a>
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="din@epost.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-primary font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Skickar…" : "Skicka inloggningslänk"}
          </button>
        </form>
      )}

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <p className="text-center text-xs text-muted-foreground">
        Är du barn?{" "}
        <a href="/barn" className="underline">
          Logga in här
        </a>
        .
      </p>
    </main>
  );
}
