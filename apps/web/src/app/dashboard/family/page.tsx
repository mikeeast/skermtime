import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveFamilyId, listFamilies } from "@/lib/family/server";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  createCoParentInvite,
  ensureReferralCode,
  revokeCoParentInvite,
  switchFamily,
} from "../family-actions";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://skermtime.vercel.app";

export default async function FamilyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const familyId = await getActiveFamilyId(supabase);
  if (!familyId) redirect("/dashboard");

  const [families, membersRes, invitesRes, refRes] = await Promise.all([
    listFamilies(supabase),
    supabase.from("family_members").select("user_id, role").eq("family_id", familyId),
    supabase
      .from("family_invites")
      .select("id, code, expires_at")
      .eq("family_id", familyId)
      .is("accepted_by", null)
      .order("created_at"),
    supabase.from("referral_codes").select("code").eq("family_id", familyId).maybeSingle(),
  ]);

  const members = membersRes.data ?? [];
  const invites = invitesRes.data ?? [];
  const refCode = refRes.data?.code as string | undefined;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
            ← Översikt
          </Link>
          <span className="font-medium">Familj</span>
        </nav>
        <ThemeToggle />
      </div>

      <h1 className="text-2xl font-bold">Familj</h1>

      {families.length > 1 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Aktiv familj</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {families.map((f) => (
              <form key={f.id} action={switchFamily}>
                <input type="hidden" name="familyId" value={f.id} />
                <button
                  className={`rounded-lg border px-3 py-1 text-sm transition ${
                    f.id === familyId
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {f.name}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Vuxna i familjen</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {m.role === "owner" ? "Ägare" : "Förälder"}
              </span>
              {m.user_id === user.id ? "Du" : "Inbjuden vuxen"}
            </li>
          ))}
        </ul>

        <h3 className="mt-4 text-sm font-semibold">Bjud in en till vuxen</h3>
        {invites.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <span className="break-all font-mono text-xs">
                  {APP}/inbjudan/{inv.code}
                </span>
                <form action={revokeCoParentInvite} className="ml-auto">
                  <input type="hidden" name="inviteId" value={inv.id} />
                  <button className="text-xs text-muted-foreground transition hover:text-red-500">
                    Återkalla
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={createCoParentInvite} className="mt-3">
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Skapa inbjudningslänk
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Bjud in en familj</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tipsa en annan familj — den får 30 dagars förlängd provperiod och ni får bonusminuter.
        </p>
        {refCode ? (
          <p className="mt-3 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
            {APP}/inbjudan-familj/{refCode}
          </p>
        ) : (
          <form action={ensureReferralCode} className="mt-3">
            <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
              Skapa värvningslänk
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
