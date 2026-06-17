import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  activateLibraryChore,
  createChore,
  deleteChore,
  markChoreDone,
  setChoreReward,
} from "../chore-actions";

type Chore = {
  id: string;
  category: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  approval_mode: string;
};
type Child = { id: string; alias: string; icon: string | null };

const APPROVAL_LABEL: Record<string, string> = {
  auto: "auto",
  parent: "förälder",
  ai: "AI-foto",
};

export default async function ChoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: fams } = await supabase.from("families").select("id, name").limit(1);
  const family = fams?.[0];
  if (!family) redirect("/dashboard");

  const [familyChoresRes, libraryRes, childrenRes] = await Promise.all([
    supabase
      .from("chores")
      .select("id, category, name, icon, reward_minutes, approval_mode")
      .eq("family_id", family.id)
      .order("category"),
    supabase
      .from("chores")
      .select("id, category, name, icon, reward_minutes, approval_mode")
      .is("family_id", null)
      .order("category"),
    supabase
      .from("child_profiles")
      .select("id, alias, icon")
      .eq("family_id", family.id)
      .order("created_at"),
  ]);

  const familyChores = (familyChoresRes.data ?? []) as Chore[];
  const library = (libraryRes.data ?? []) as Chore[];
  const kids = (childrenRes.data ?? []) as Child[];
  const activeKey = new Set(familyChores.map((c) => `${c.category}|${c.name}`));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-8 flex gap-4 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:underline">
          ← Översikt
        </Link>
        <span className="font-medium">Sysslor</span>
        <Link href="/dashboard/approvals" className="text-gray-500 hover:underline">
          Godkännanden
        </Link>
      </nav>

      <h1 className="text-2xl font-bold">Sysslor</h1>

      {/* Family chores */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Familjens sysslor</h2>
        {familyChores.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Inga ännu — lägg till från biblioteket nedan eller skapa en egen.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {familyChores.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
              >
                <span className="font-medium">
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {c.category} · {APPROVAL_LABEL[c.approval_mode] ?? c.approval_mode}
                </span>
                <form action={setChoreReward} className="ml-auto flex items-center gap-1">
                  <input type="hidden" name="choreId" value={c.id} />
                  <input
                    name="reward"
                    type="number"
                    min={0}
                    defaultValue={c.reward_minutes}
                    className="h-8 w-16 rounded border border-gray-300 px-2 text-right text-sm"
                  />
                  <span className="text-xs text-gray-500">min</span>
                  <button className="h-8 rounded bg-gray-900 px-2 text-xs font-medium text-white">
                    Spara
                  </button>
                </form>
                {kids.length > 0 && (
                  <form action={markChoreDone} className="flex items-center gap-1">
                    <input type="hidden" name="choreId" value={c.id} />
                    <select
                      name="childId"
                      className="h-8 rounded border border-gray-300 px-1 text-sm"
                    >
                      {kids.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.alias}
                        </option>
                      ))}
                    </select>
                    <button className="h-8 rounded bg-green-600 px-2 text-xs font-medium text-white">
                      Klar ✓
                    </button>
                  </form>
                )}
                <form action={deleteChore}>
                  <input type="hidden" name="choreId" value={c.id} />
                  <button className="h-8 px-1 text-xs text-gray-400 hover:text-red-600">
                    Ta bort
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create custom */}
      <section className="mt-8 rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold">Skapa egen syssla</h2>
        <form action={createChore} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-gray-500">
            Namn
            <input
              name="name"
              required
              className="mt-1 h-9 w-48 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Kategori
            <input
              name="category"
              placeholder="Eget"
              className="mt-1 h-9 w-32 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Minuter
            <input
              name="reward"
              type="number"
              min={0}
              defaultValue={10}
              className="mt-1 h-9 w-20 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Godkännande
            <select
              name="approval"
              className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm text-gray-900"
            >
              <option value="parent">förälder</option>
              <option value="auto">auto</option>
              <option value="ai">AI-foto</option>
            </select>
          </label>
          <button className="h-9 rounded-lg bg-black px-4 text-sm font-medium text-white">
            Lägg till
          </button>
        </form>
      </section>

      {/* Library */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bibliotek</h2>
        <p className="mt-1 text-sm text-gray-500">Lägg till färdiga sysslor med vettiga standardvärden.</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {library.map((c) => {
            const already = activeKey.has(`${c.category}|${c.name}`);
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <span>
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </span>
                <span className="text-xs text-gray-400">{c.reward_minutes} min</span>
                <form action={activateLibraryChore} className="ml-auto">
                  <input type="hidden" name="choreId" value={c.id} />
                  <button
                    disabled={already}
                    className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {already ? "Tillagd" : "Lägg till"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
