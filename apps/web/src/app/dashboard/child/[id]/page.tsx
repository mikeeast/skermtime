import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adjustBalance, awardBounty } from "../../chore-actions";
import { createDevice, revokeDevice } from "../../device-actions";

type LedgerEntry = {
  id: string;
  delta_minutes: number;
  kind: string;
  note: string | null;
  created_at: string;
};

type DeviceRow = {
  id: string;
  name: string;
  paired: boolean;
  pairing_code: string | null;
  revoked: boolean;
  last_seen_at: string | null;
};

const KIND_LABEL: Record<string, string> = {
  earn_chore: "Syssla",
  earn_strava: "Löprunda",
  spend: "Förbrukad",
  adjust: "Justering",
  bounty: "Bonus (hack)",
  clawback: "Återtag",
};

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("child_profiles")
    .select("id, alias, icon, balance_minutes")
    .eq("id", id)
    .single();
  if (!child) notFound();

  const { data: ledgerData } = await supabase
    .from("ledger_entries")
    .select("id, delta_minutes, kind, note, created_at")
    .eq("child_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const ledger = (ledgerData ?? []) as LedgerEntry[];

  const { data: devicesData } = await supabase
    .from("devices")
    .select("id, name, paired, pairing_code, revoked, last_seen_at")
    .eq("child_id", id)
    .order("created_at");
  const devices = (devicesData ?? []) as DeviceRow[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:underline">
          ← Översikt
        </Link>
      </nav>

      <h1 className="text-2xl font-bold">
        {child.icon ? `${child.icon} ` : ""}
        {child.alias}
      </h1>
      <p className="mt-1 text-3xl font-bold tabular-nums">{child.balance_minutes} min</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form action={adjustBalance} className="rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold">Justera saldo</h2>
          <input type="hidden" name="childId" value={child.id} />
          <input
            name="minutes"
            type="number"
            placeholder="+/- minuter"
            className="mt-2 h-9 w-full rounded border border-gray-300 px-2 text-sm"
          />
          <input
            name="note"
            placeholder="Anledning (valfri)"
            className="mt-2 h-9 w-full rounded border border-gray-300 px-2 text-sm"
          />
          <button className="mt-2 h-9 w-full rounded-lg bg-black text-sm font-medium text-white">
            Justera
          </button>
        </form>

        <form action={awardBounty} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold">🏴‍☠️ Hacker-bonus</h2>
          <p className="mt-1 text-xs text-amber-800">Belöna ett upptäckt kringgående.</p>
          <input type="hidden" name="childId" value={child.id} />
          <input
            name="type"
            placeholder="t.ex. clock-tamper"
            className="mt-2 h-9 w-full rounded border border-amber-300 px-2 text-sm"
          />
          <input
            name="minutes"
            type="number"
            min={1}
            placeholder="bonusminuter"
            className="mt-2 h-9 w-full rounded border border-amber-300 px-2 text-sm"
          />
          <input
            name="writeup"
            placeholder="Hur gjorde hen?"
            className="mt-2 h-9 w-full rounded border border-amber-300 px-2 text-sm"
          />
          <button className="mt-2 h-9 w-full rounded-lg bg-amber-600 text-sm font-medium text-white">
            Ge bonus
          </button>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Enheter</h2>
        <p className="mt-1 text-sm text-gray-500">
          Para barnets dator med agenten. Koden gäller i 15 minuter.
        </p>
        {devices.filter((d) => !d.revoked).length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Inga enheter ännu.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {devices
              .filter((d) => !d.revoked)
              .map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{d.name}</span>
                  {d.paired ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      parad
                      {d.last_seen_at
                        ? ` · sedd ${new Date(d.last_seen_at).toLocaleString("sv-SE")}`
                        : ""}
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      kod: <span className="font-mono font-semibold">{d.pairing_code}</span>
                    </span>
                  )}
                  <form action={revokeDevice} className="ml-auto">
                    <input type="hidden" name="deviceId" value={d.id} />
                    <input type="hidden" name="childId" value={child.id} />
                    <button className="text-xs text-gray-400 hover:text-red-600">Återkalla</button>
                  </form>
                </li>
              ))}
          </ul>
        )}
        <form action={createDevice} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="childId" value={child.id} />
          <input
            name="name"
            placeholder="Datornamn (t.ex. Felix-PC)"
            className="h-9 flex-1 rounded border border-gray-300 px-2 text-sm"
          />
          <button className="h-9 rounded-lg bg-black px-4 text-sm font-medium text-white">
            Skapa parningskod
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Historik</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Inga händelser ännu.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-gray-100">
            {ledger.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="text-gray-700">{KIND_LABEL[e.kind] ?? e.kind}</span>
                  {e.note ? <span className="text-gray-400"> · {e.note}</span> : null}
                  <span className="block text-xs text-gray-400">
                    {new Date(e.created_at).toLocaleString("sv-SE")}
                  </span>
                </span>
                <span
                  className={`tabular-nums font-medium ${
                    e.delta_minutes >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {e.delta_minutes >= 0 ? "+" : ""}
                  {e.delta_minutes} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
