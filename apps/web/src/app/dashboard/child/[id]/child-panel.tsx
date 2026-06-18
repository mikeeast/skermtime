"use client";

import { useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { adjustBalance, awardBounty, markChoreDone, setChildPin } from "../../chore-actions";
import { createDevice, revokeDevice } from "../../device-actions";
import { disconnectStrava, updateFamilyEarning } from "../../strava-actions";
import { formatMinutes } from "@/lib/earning/format";

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
type ChoreOpt = {
  id: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  approval_mode: string;
};
type StravaConnection = {
  id: string;
  athlete_id: number;
  scope: string | null;
  created_at: string;
};
type RunRow = {
  id: string;
  type: string | null;
  distance_m: number;
  moving_time_s: number | null;
  started_at: string;
  minutes_awarded: number;
};
type FamilyEarning = { minutesPerKm: number; dailyCap: number | null };

const KIND_LABEL: Record<string, string> = {
  earn_chore: "Syssla",
  earn_strava: "Löprunda",
  spend: "Förbrukad",
  adjust: "Justering",
  bounty: "Bonus (hack)",
  clawback: "Återtag",
  streak_bonus: "Svitbonus 🔥",
};

const input =
  "h-9 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40";
const amberInput =
  "h-9 w-full rounded-lg border border-amber-500/40 bg-card px-2 text-sm outline-none placeholder:text-amber-700/60 focus:ring-2 focus:ring-amber-500/40 dark:placeholder:text-amber-300/50";

export function ChildPanel({
  childId,
  alias,
  icon,
  loginCode,
  initialBalance,
  initialLedger,
  initialDevices,
  chores,
  stravaConnection,
  recentRuns,
  familyEarning,
  stravaStatus,
}: {
  childId: string;
  alias: string;
  icon: string | null;
  loginCode: string;
  initialBalance: number;
  initialLedger: LedgerEntry[];
  initialDevices: DeviceRow[];
  chores: ChoreOpt[];
  stravaConnection: StravaConnection | null;
  recentRuns: RunRow[];
  familyEarning: FamilyEarning;
  stravaStatus?: "connected" | "error";
}) {
  const [wallet, walletDispatch] = useOptimistic(
    { balance: initialBalance, ledger: initialLedger },
    (
      state: { balance: number; ledger: LedgerEntry[] },
      a: { minutes: number; kind: "adjust" | "bounty" | "earn_chore"; note: string | null },
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

  const [logged, setLogged] = useState<string | null>(null);
  const adjustRef = useRef<HTMLFormElement>(null);
  const bountyRef = useRef<HTMLFormElement>(null);
  const deviceRef = useRef<HTMLFormElement>(null);

  async function onLogChore(c: ChoreOpt) {
    // Auto-approved chores credit immediately; others go to the approvals queue.
    if (c.approval_mode === "auto") {
      walletDispatch({ minutes: c.reward_minutes, kind: "earn_chore", note: c.name });
    }
    setLogged(c.id);
    setTimeout(() => setLogged((cur) => (cur === c.id ? null : cur)), 2000);
    const fd = new FormData();
    fd.set("choreId", c.id);
    fd.set("childId", childId);
    await markChoreDone(fd);
  }

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
      <p className="mt-1 text-3xl font-bold tabular-nums">{formatMinutes(wallet.balance)}</p>
      <p className="text-sm text-muted-foreground">{wallet.balance} minuter skärmtid kvar</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Logga en syssla</h2>
        <p className="mt-1 text-sm text-muted-foreground">Bocka av något {alias} har gjort.</p>
        {chores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Inga sysslor än —{" "}
            <Link href="/dashboard/chores" className="underline">
              lägg till på Sysslor
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {chores.map((c) => (
              <form key={c.id} action={() => onLogChore(c)}>
                <button
                  type="submit"
                  className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted active:scale-[0.98]"
                >
                  <span className="text-sm font-medium">
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </span>
                  {logged === c.id ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ Loggad!
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      🎮 {formatMinutes(c.reward_minutes)}
                      {c.approval_mode !== "auto" ? " · kräver ok" : ""}
                    </span>
                  )}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Strava</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Koppla {alias}s Strava så blir löprundor automatiskt till skärmtid.
        </p>

        {stravaStatus === "connected" && (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            ✅ Strava är kopplat!
          </p>
        )}
        {stravaStatus === "error" && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            Något gick fel vid Strava-kopplingen. Försök igen.
          </p>
        )}

        {stravaConnection ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                🟢 Kopplat
              </span>
              <span className="text-muted-foreground">Strava-id {stravaConnection.athlete_id}</span>
              <form action={disconnectStrava} className="ml-auto">
                <input type="hidden" name="childId" value={childId} />
                <button className="text-xs text-muted-foreground transition hover:text-red-500">
                  Koppla bort
                </button>
              </form>
            </div>

            {recentRuns.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {recentRuns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {(Number(r.distance_m) / 1000).toFixed(1)} km
                      <span className="block text-xs text-muted-foreground">
                        {new Date(r.started_at).toLocaleDateString("sv-SE")}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{r.minutes_awarded} min
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <a
            href={`/api/strava/connect?child=${childId}`}
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#fc4c02] px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Koppla Strava
          </a>
        )}

        <form action={updateFamilyEarning} className="mt-4 border-t border-border pt-4">
          <input type="hidden" name="childId" value={childId} />
          <h3 className="text-sm font-semibold">Intjäning</h3>
          <p className="mt-1 text-xs text-muted-foreground">Gäller hela familjen.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Minuter per km
              <input
                name="minutesPerKm"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={familyEarning.minutesPerKm}
                className={`w-28 ${input}`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Dagligt tak (min)
              <input
                name="dailyCap"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={familyEarning.dailyCap ?? ""}
                placeholder="Inget tak"
                className={`w-28 ${input}`}
              />
            </label>
            <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
              Spara
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form
          ref={adjustRef}
          action={onAdjust}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h2 className="text-sm font-semibold">Justera saldo</h2>
          <input name="minutes" type="number" inputMode="numeric" placeholder="+/- minuter" className={`mt-2 ${input}`} />
          <input name="note" placeholder="Anledning (valfri)" className={`mt-2 ${input}`} />
          <button className="mt-2 h-9 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Justera
          </button>
        </form>

        <form
          ref={bountyRef}
          action={onBounty}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <h2 className="text-sm font-semibold">🏴‍☠️ Hacker-bonus</h2>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Belöna ett upptäckt kringgående.
          </p>
          <input name="type" placeholder="t.ex. clock-tamper" className={`mt-2 ${amberInput}`} />
          <input
            name="minutes"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="bonusminuter"
            className={`mt-2 ${amberInput}`}
          />
          <input name="writeup" placeholder="Hur gjorde hen?" className={`mt-2 ${amberInput}`} />
          <button className="mt-2 h-9 w-full rounded-lg bg-amber-600 text-sm font-medium text-white transition hover:bg-amber-700">
            Ge bonus
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Barnets inloggning</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {alias} loggar in på <span className="font-medium">/barn</span> med koden nedan och sin
          PIN.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-muted px-3 py-1 font-mono text-lg font-semibold tracking-widest">
            {loginCode}
          </span>
          <form action={setChildPin} className="flex items-center gap-2">
            <input type="hidden" name="childId" value={childId} />
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              minLength={4}
              placeholder="Ny PIN (min 4)"
              className="h-9 w-36 rounded-lg border border-border bg-card px-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            />
            <button className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition hover:opacity-90">
              Sätt PIN
            </button>
          </form>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Enheter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para barnets dator med agenten. Koden gäller i 15 minuter.
        </p>
        {visibleDevices.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Inga enheter ännu.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {visibleDevices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium">{d.name}</span>
                {d.paired ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                    parad
                    {d.last_seen_at
                      ? ` · sedd ${new Date(d.last_seen_at).toLocaleString("sv-SE")}`
                      : ""}
                  </span>
                ) : d.pairing_code ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                    kod: <span className="font-mono font-semibold">{d.pairing_code}</span>
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    skapar kod…
                  </span>
                )}
                <form action={() => onRevoke(d.id)} className="ml-auto">
                  <button className="text-xs text-muted-foreground transition hover:text-red-500">
                    Återkalla
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form ref={deviceRef} action={onCreateDevice} className="mt-3 flex items-center gap-2">
          <input
            name="name"
            placeholder="Datornamn (t.ex. Felix-PC)"
            className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Skapa parningskod
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Historik</h2>
        {wallet.ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Inga händelser ännu.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {wallet.ledger.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span>{KIND_LABEL[e.kind] ?? e.kind}</span>
                  {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                  <span className="block text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("sv-SE")}
                  </span>
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    e.delta_minutes >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500"
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
