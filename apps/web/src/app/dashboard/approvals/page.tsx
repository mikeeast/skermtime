import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { approveCompletion, rejectCompletion } from "../chore-actions";

type Pending = {
  id: string;
  created_at: string;
  photo_before: string | null;
  photo_after: string | null;
  ai_verdict: { done?: boolean; confidence?: number; reason?: string } | null;
  chores: { name: string; icon: string | null; reward_minutes: number } | null;
  child_profiles: { alias: string } | null;
};

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: fams } = await supabase.from("families").select("id").limit(1);
  const family = fams?.[0];
  if (!family) redirect("/dashboard");

  const { data } = await supabase
    .from("chore_completions")
    .select(
      "id, created_at, photo_before, photo_after, ai_verdict, chores(name, icon, reward_minutes), child_profiles(alias)",
    )
    .eq("family_id", family.id)
    .eq("status", "pending")
    .order("created_at");
  const pending = (data ?? []) as unknown as Pending[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-8 flex gap-4 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:underline">
          ← Översikt
        </Link>
        <Link href="/dashboard/chores" className="text-gray-500 hover:underline">
          Sysslor
        </Link>
        <span className="font-medium">Godkännanden</span>
      </nav>

      <h1 className="text-2xl font-bold">Att godkänna</h1>

      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Inget väntar på godkännande. 🎉</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {pending.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {p.chores?.icon ? `${p.chores.icon} ` : ""}
                  {p.chores?.name ?? "Syssla"}
                </span>
                <span className="text-sm text-gray-500">
                  {p.child_profiles?.alias} · {p.chores?.reward_minutes ?? 0} min
                </span>
              </div>
              {p.ai_verdict && (
                <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  AI: {p.ai_verdict.done ? "ser klar ut" : "osäker"} (
                  {Math.round((p.ai_verdict.confidence ?? 0) * 100)}%) — {p.ai_verdict.reason}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <form action={approveCompletion}>
                  <input type="hidden" name="completionId" value={p.id} />
                  <button className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white">
                    Godkänn
                  </button>
                </form>
                <form action={rejectCompletion}>
                  <input type="hidden" name="completionId" value={p.id} />
                  <button className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-medium">
                    Avslå
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
