import { redirect } from "next/navigation";
import Link from "next/link";
import { getChildId } from "@/lib/child/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFriendLeaderboard, listFriendCards } from "@/lib/social/friends";
import { formatMinutes } from "@/lib/earning/format";
import { ThemeToggle } from "@/components/theme-toggle";
import { cancelFriendRequest, removeFriend, requestFriend } from "../social-actions";

type Req = {
  id: string;
  requester_child_id: string;
  requester_alias: string;
  target_alias: string;
  status: string;
};

export default async function KompisarPage() {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const admin = createAdminClient();

  const { data: me } = await admin
    .from("child_profiles")
    .select("alias, icon, friend_code")
    .eq("id", childId)
    .single();
  if (!me) redirect("/barn");

  const [friends, leaderboard, reqRes] = await Promise.all([
    listFriendCards(admin, childId),
    getFriendLeaderboard(admin, childId),
    admin
      .from("child_friend_requests")
      .select("id, requester_child_id, requester_alias, target_alias, status")
      .or(`requester_child_id.eq.${childId},target_child_id.eq.${childId}`)
      .eq("status", "pending"),
  ]);
  const requests = (reqRes.data ?? []) as Req[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/barn/start" className="text-sm text-muted-foreground transition hover:text-foreground">
          ← Tillbaka
        </Link>
        <ThemeToggle />
      </header>

      <h1 className="text-2xl font-bold">Kompisar</h1>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Din kompiskod</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-widest">{me.friend_code}</p>
        <p className="mt-1 text-xs text-muted-foreground">Dela den med en kompis!</p>
      </section>

      <form action={requestFriend} className="mt-4 flex gap-2">
        <input
          name="code"
          placeholder="Skriv kompisens kod"
          autoCapitalize="characters"
          className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-center font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button className="h-11 rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:opacity-90">
          Lägg till
        </button>
      </form>

      {requests.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Väntar</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((r) => {
              const outgoing = r.requester_child_id === childId;
              const other = outgoing ? r.target_alias : r.requester_alias;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-2 text-sm"
                >
                  <span>
                    {other}{" "}
                    <span className="text-xs text-muted-foreground">· väntar på förälder ✋</span>
                  </span>
                  {outgoing && (
                    <form action={cancelFriendRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button className="text-xs text-muted-foreground transition hover:text-red-500">
                        Ångra
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Mina kompisar</h2>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Inga kompisar än — dela din kod!</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {friends.map((f) => (
              <li
                key={f.childId}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4 text-center"
              >
                <span className="text-3xl">{f.icon ?? "🙂"}</span>
                <span className="text-sm font-medium">{f.alias}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">🔥 {f.streak} d</span>
                <form action={removeFriend}>
                  <input type="hidden" name="friendId" value={f.childId} />
                  <button className="text-[11px] text-muted-foreground transition hover:text-red-500">
                    Ta bort
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Topplista — denna vecka</h2>
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {leaderboard.map((row, i) => (
            <li
              key={row.childId}
              className={`flex items-center justify-between py-2 text-sm ${
                row.isSelf ? "font-semibold" : ""
              }`}
            >
              <span>
                {i + 1}. {row.icon ?? "🙂"} {row.alias}
                {row.isSelf ? " (du)" : ""}
              </span>
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMinutes(row.earned)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
