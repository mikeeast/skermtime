import Stripe from "stripe";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

/** Server-only Stripe client. The secret key never reaches the browser. */
export function getStripe(): Stripe {
  if (!cached) cached = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return cached;
}

/** Map a Stripe subscription status to families.plan_status (a CHECK-constrained set). */
export function mapPlanStatus(status: string): "trialing" | "active" | "past_due" | "canceled" {
  if (status === "trialing" || status === "active") return status;
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
}
