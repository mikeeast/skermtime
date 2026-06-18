"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveFamilyId } from "@/lib/family/server";
import { getStripe, stripeConfigured } from "@/lib/stripe/stripe";

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function familyId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const id = await getActiveFamilyId(supabase);
  if (!id) redirect("/dashboard");
  return { supabase, user, id };
}

export async function startCheckout() {
  if (!stripeConfigured()) redirect("/dashboard/billing?error=not_configured");
  const { user, id } = await familyId();
  const base = await siteOrigin();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    client_reference_id: id,
    customer_email: user.email ?? undefined,
    metadata: { family_id: id },
    allow_promotion_codes: true,
    success_url: `${base}/dashboard/billing?status=success`,
    cancel_url: `${base}/dashboard/billing?status=cancelled`,
  });

  if (session.url) redirect(session.url);
  redirect("/dashboard/billing?error=checkout");
}

export async function openPortal() {
  if (!stripeConfigured()) redirect("/dashboard/billing?error=not_configured");
  const { supabase, id } = await familyId();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("family_id", id)
    .maybeSingle();
  const customer = sub?.stripe_customer_id as string | undefined;
  if (!customer) redirect("/dashboard/billing?error=no_customer");

  const base = await siteOrigin();
  const portal = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${base}/dashboard/billing`,
  });
  redirect(portal.url);
}
