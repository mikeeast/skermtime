import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { openPortal, startCheckout } from "../billing-actions";

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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:underline">
          ← Översikt
        </Link>
      </nav>

      <h1 className="text-2xl font-bold">Abonnemang</h1>

      <div className="mt-4 rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">{family.name}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        {family.trial_ends_at && status === "trialing" && (
          <p className="mt-1 text-sm text-gray-500">
            Provperiod till {new Date(family.trial_ends_at).toLocaleDateString("sv-SE")}
          </p>
        )}
        {sub?.current_period_end && (
          <p className="mt-1 text-sm text-gray-500">
            Nästa förnyelse {new Date(sub.current_period_end).toLocaleDateString("sv-SE")}
          </p>
        )}

        <div className="mt-4">
          {!configured ? (
            <p className="text-sm text-gray-500">
              Stripe är inte konfigurerat i den här miljön (sätt STRIPE_SECRET_KEY m.fl.).
            </p>
          ) : hasCustomer ? (
            <form action={openPortal}>
              <button className="h-10 rounded-lg bg-black px-5 text-sm font-medium text-white">
                Hantera abonnemang
              </button>
            </form>
          ) : (
            <form action={startCheckout}>
              <button className="h-10 rounded-lg bg-black px-5 text-sm font-medium text-white">
                Starta abonnemang (14 dagar gratis)
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
