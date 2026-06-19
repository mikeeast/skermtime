import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveFamilyId } from "@/lib/family/server";
import { CHORE_PHOTO_BUCKET } from "@/lib/chore/complete";
import { ApprovalsList, type Pending } from "./approvals-list";
import { ThemeToggle } from "@/components/theme-toggle";

type Row = {
  id: string;
  ai_verdict: { done?: boolean; confidence?: number; reason?: string } | null;
  photo_before: string | null;
  photo_after: string | null;
  chores: { name: string; icon: string | null; reward_minutes: number } | null;
  child_profiles: { alias: string } | null;
};

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const familyId = await getActiveFamilyId(supabase);
  if (!familyId) redirect("/dashboard");

  const { data } = await supabase
    .from("chore_completions")
    .select(
      "id, ai_verdict, photo_before, photo_after, chores(name, icon, reward_minutes), child_profiles(alias)",
    )
    .eq("family_id", familyId)
    .eq("status", "pending")
    .order("created_at");

  const rows = (data ?? []) as unknown as Row[];

  // Photos live in a private bucket — mint short-lived signed URLs with the admin
  // client. The rows are already RLS-scoped to this parent's family above.
  const photoPaths = rows.flatMap((r) =>
    [r.photo_before, r.photo_after].filter((p): p is string => Boolean(p)),
  );
  const urlByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from(CHORE_PHOTO_BUCKET)
      .createSignedUrls(photoPaths, 300);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const pending: Pending[] = rows.map((p) => ({
    id: p.id,
    ai_verdict: p.ai_verdict,
    chore_name: p.chores?.name ?? "Syssla",
    chore_icon: p.chores?.icon ?? null,
    reward_minutes: p.chores?.reward_minutes ?? 0,
    child_alias: p.child_profiles?.alias ?? "",
    beforeUrl: p.photo_before ? urlByPath.get(p.photo_before) ?? null : null,
    afterUrl: p.photo_after ? urlByPath.get(p.photo_after) ?? null : null,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
            ← Översikt
          </Link>
          <Link
            href="/dashboard/chores"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Sysslor
          </Link>
          <span className="font-medium">Godkännanden</span>
        </nav>
        <ThemeToggle />
      </div>

      <h1 className="text-2xl font-bold">Att godkänna</h1>
      <ApprovalsList initial={pending} />
    </main>
  );
}
