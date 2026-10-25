import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = serverEnv().stripeSecret;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!key.startsWith("sk_test_") && process.env.FACET_ALLOW_LIVE_STRIPE !== "true") {
    // Safety net while Facet is pre-launch: refuse live keys unless explicitly allowed
    throw new Error("Live Stripe keys are disabled. Use sk_test_ keys, or set FACET_ALLOW_LIVE_STRIPE=true at launch.");
  }
  return (client ??= new Stripe(key));
}

export const billingConfigured = () => Boolean(serverEnv().stripeSecret && serverEnv().stripePriceMonthly);

/** Mirror a Stripe subscription into our subscriptions table. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const db = supabaseAdmin();
  let userId = sub.metadata?.user_id;
  if (!userId) {
    const { data } = await db.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) {
    console.warn("[stripe] subscription without a known user", sub.id);
    return;
  }
  const item = sub.items.data[0];
  // Since API version 2025-03-31 the billing period lives on the subscription item
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  await db.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: item?.price.id ?? null,
    interval: item?.price.recurring?.interval ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  }, { onConflict: "user_id" });
}
