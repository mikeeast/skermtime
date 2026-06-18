"use client";

import { useOptimistic, useRef } from "react";
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

export function ChildPanel({
  childId,
  alias,
  icon,
  initialBalance,
  initialLedger,
  initialDevices,
}: {
  childId: string;
  alias: string;
  icon: string | null;
  initialBalance: number;
  initialLedger: LedgerEntry[];
  initialDevices: DeviceRow[];
}) {
  const [wallet, walletDispatch] = useOptimistic(
    { balance: initialBalance, ledger: initialLedger },
    (
      state: { balance: number; ledger: LedgerEntry[] },
      a: { minutes: number; kind: "adjust" | "bounty"; note: string | null },
    ) => ({
      balance: state.balance + a.minutes,
      ledger: [
        {
          id: `temp-${crypto.randomUUID()}`,
          delta_minutes: a.minutes,
          kind: a.kind,
          note: a.note,
          created_at: new Date().toISOString(),
        },
        ...state.ledger,
      ],
    }),
  );

  const [devices, deviceDispatch] = useOptimistic(
    initialDevices,
    (
      state: DeviceRow[],
      a: { type: "add"; device: DeviceRow } | { type: "remove"; id: string },
    ) => (a.type === "add" ? [...state, a.device] : state.filter((d) => d.id !== a.id)),
  );

  const adjustRef = useRef<HTMLFormElement>(null);
  const bountyRef = useRef<HTMLFormElement>(null);
  const deviceRef = useRef<HTMLFormElement>(null);

  async function onAdjust(formData: FormData) {
    const minutes = Number(formData.get("minutes"));
    if (!Number.isFinite(minutes) || minutes === 0) return;
    const note = String(formData.get("note") ?? "") || null;
    walletDispatch({ minutes: Math.trunc(minutes), kind: "adjust", note });
    adjustRef.current?.reset();
    await adjustBalance(formData);
  }

  async function onBounty(formData: FormData) {
    const minutes = Number(formData.get("minutes"));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const writeup = String(formData.get("writeup") ?? "") || null;
    walletDispatch({ minutes: Math.max(0, Math.trunc(minutes)), kind: "bounty", note: writeup });
    bountyRef.current?.reset();
    await awardBounty(formData);
  }

  async function onCreateDevice(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim() || "PC";
    deviceDispatch({
      type: "add",
      device: {
        id: `temp-${crypto.randomUUID()}`,
        name,
        paired: false,
        pairing_code: null,
        revoked: false,
        last_seen_at: null,
      },
    });
    deviceRef.current?.reset();
    await createDevice(formData);
  }

  async function onRevoke(id: string) {
    deviceDispatch({ type: "remove", id });
    const fd = new FormData();
    fd.set("deviceId", id);
    fd.set("childId", childId);
    await revokeDevice(fd);
  }

  const visibleDevices = devices.filter((d) => !d.revoked);

  return (
    <>
      <h1 className="text-2xl font-bold">
        {icon ? `${icon} ` : ""}
        {alias}
      </h1>
      <p className="mt-1 text-3xl font-bold tabular-nums">{wallet.balance} min</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form ref={adjustRef} action={onAdjust} className="rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold">Justera saldo</h2>
          <input type="hidden" name="childId" value={childId} />
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

        <form
          ref={bountyRef}
          action={onBounty}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <h2 className="text-sm font-semibold">🏴‍☠️ Hacker-bonus</h2>
          <p className="mt-1 text-xs text-amber-800">Belöna ett upptäckt kringgående.</p>
          <input type="hidden" name="childId" value={childId} />
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
        {visibleDevices.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Inga enheter ännu.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {visibleDevices.map((d) => (
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
                ) : d.pairing_code ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    kod: <span className="font-mono font-semibold">{d.pairing_code}</span>
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    skapar kod…
                  </span>
                )}
                <form action={() => onRevoke(d.id)} className="ml-auto">
                  <button className="text-xs text-gray-400 hover:text-red-600">Återkalla</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form ref={deviceRef} action={onCreateDevice} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="childId" value={childId} />
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
        {wallet.ledger.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Inga händelser ännu.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-gray-100">
            {wallet.ledger.map((e) => (
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
    </>
  );
}
