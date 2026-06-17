import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, mapPlanStatus, stripeConfigured } from "@/lib/stripe/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  async function syncSubscription(sub: Stripe.Subscription, hintFamilyId: string | null) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    // current_period_end moved onto items in newer API versions — read defensively.
    const raw = sub as unknown as {
      current_period_end?: number;
      items?: { data?: Array<{ current_period_end?: number }> };
    };
    const endSec = raw.current_period_end ?? raw.items?.data?.[0]?.current_period_end ?? null;

    let family = hintFamilyId ?? sub.metadata?.family_id ?? null;
    if (!family) {
      const { data } = await admin
        .from("subscriptions")
        .select("family_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      family = data?.family_id ?? null;
    }
    if (!family) return;

    await admin.from("subscriptions").upsert(
      {
        family_id: family,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        price_id: sub.items.data[0]?.price?.id ?? null,
        current_period_end: endSec ? new Date(endSec * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "family_id" },
    );
    await admin.from("families").update({ plan_status: mapPlanStatus(sub.status) }).eq("id", family);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const family = session.client_reference_id ?? session.metadata?.family_id ?? null;
      if (session.subscription) {
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub, family);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription, null);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);
      if (customerId) {
        const { data } = await admin
          .from("subscriptions")
          .select("family_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (data?.family_id) {
          await admin.from("families").update({ plan_status: "past_due" }).eq("id", data.family_id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
