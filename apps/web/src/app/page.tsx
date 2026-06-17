import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Skermtime</h1>
        <p className="mt-4 text-lg text-gray-600">
          Skärmtid blir något barnet <span className="font-semibold">tjänar</span> — genom att röra
          på sig och hjälpa till. Inte något du tjatar om.
        </p>
      </div>

      <ul className="flex flex-col gap-3 text-gray-700">
        <li className="flex gap-3">
          <span>🏃</span> Löprundor via Strava ger minuter automatiskt.
        </li>
        <li className="flex gap-3">
          <span>🧹</span> Sysslor bockas av — vissa kontrolleras av AI på foto.
        </li>
        <li className="flex gap-3">
          <span>💻</span> En agent på datorn räknar ner och låser när tiden är slut.
        </li>
        <li className="flex gap-3">
          <span>🏴‍☠️</span> Försöker hen kringgå systemet? Det ger bonus, inte straff.
        </li>
      </ul>

      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="flex h-12 items-center rounded-lg bg-black px-6 font-medium text-white"
        >
          Kom igång — 14 dagar gratis
        </Link>
        <Link href="/login" className="text-sm text-gray-500 hover:underline">
          Logga in
        </Link>
      </div>
    </main>
  );
}
