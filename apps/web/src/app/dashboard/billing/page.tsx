import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { openPortal, startCheckout } from "../billing-actions";
import { ThemeToggle } from "@/components/theme-toggle";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Provperiod",
  active: "Aktiv",
  past_due: "Betalning misslyckades",
  canceled: "Avslutad",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: fams } = await supabase
    .from("families")
    .select("id, name, plan_status, trial_ends_at")
    .limit(1);
  const family = fams?.[0];
  if (!family) redirect("/dashboard");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_customer_id")
    .eq("family_id", family.id)
    .maybeSingle();

  const configured = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasCustomer = Boolean(sub?.stripe_customer_id);
  const status = (family.plan_status as string) ?? "trialing";
  const isActive = status === "trialing" || status === "active";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <nav className="text-sm">
          <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
            ← Översikt
          </Link>
        </nav>
        <ThemeToggle />
      </div>

      <h1 className="text-2xl font-bold">Abonnemang</h1>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{family.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isActive
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        {family.trial_ends_at && status === "trialing" && (
          <p className="mt-1 text-sm text-muted-foreground">
            Provperiod till {new Date(family.trial_ends_at).toLocaleDateString("sv-SE")}
          </p>
        )}
        {sub?.current_period_end && (
          <p className="mt-1 text-sm text-muted-foreground">
            Nästa förnyelse {new Date(sub.current_period_end).toLocaleDateString("sv-SE")}
          </p>
        )}

        <div className="mt-4">
          {!configured ? (
            <p className="text-sm text-muted-foreground">
              Stripe är inte konfigurerat i den här miljön (sätt STRIPE_SECRET_KEY m.fl.).
            </p>
          ) : hasCustomer ? (
            <form action={openPortal}>
              <button className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                Hantera abonnemang
              </button>
            </form>
          ) : (
            <form action={startCheckout}>
              <button className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                Starta abonnemang (14 dagar gratis)
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
