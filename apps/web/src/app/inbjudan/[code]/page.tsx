import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptCoParentInvite } from "@/app/dashboard/family-actions";

// Co-parent invite landing. A signed-in adult joins the family; otherwise we send
// them to log in and come back.
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/inbjudan/${code}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold">Gå med i familjen</h1>
      <p className="text-sm text-muted-foreground">
        Du har blivit inbjuden att hjälpa till att hantera en familj i Skermtime.
      </p>
      <form action={acceptCoParentInvite}>
        <input type="hidden" name="code" value={code} />
        <button className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground transition hover:opacity-90">
          Gå med
        </button>
      </form>
    </main>
  );
}
