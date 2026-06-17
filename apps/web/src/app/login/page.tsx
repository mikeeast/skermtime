"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Skermtime</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tjäna skärmtid med löprundor och sysslor.
        </p>
      </div>

      <button
        onClick={signInWithGoogle}
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 font-medium hover:bg-gray-50"
      >
        Fortsätt med Google
      </button>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        eller
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {sent ? (
        <p className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
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
            className="h-11 rounded-lg border border-gray-300 px-3"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-black font-medium text-white disabled:opacity-50"
          >
            {loading ? "Skickar…" : "Skicka inloggningslänk"}
          </button>
        </form>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </main>
  );
}
