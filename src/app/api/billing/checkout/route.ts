import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { env, serverEnv } from "@/lib/env";
import { billingConfigured, stripe } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  if (!billingConfigured()) throw new ApiError(503, "Billing isn't configured yet. Add your Stripe test keys to .env.local.");
  const b = z.object({ interval: z.enum(["month", "year"]).default("month") }).safeParse(await readJson(req).catch(() => ({})));
  const interval = b.success ? b.data.interval : "month";
  const e = serverEnv();
  const price = interval === "year" && e.stripePriceYearly ? e.stripePriceYearly : e.stripePriceMonthly;

  const db = supabaseAdmin();
  const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if (sub?.status === "active" || sub?.status === "trialing") throw new ApiError(409, "You already have Pro. Manage it from the billing portal.");

  let customer = sub?.stripe_customer_id as string | undefined;
  if (!customer) {
    const c = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } });
    customer = c.id;
    await db.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer }, { onConflict: "user_id" });
  }
  // One free trial per user: anyone who has subscribed before pays from day one
  const hadTrial = Boolean(sub?.stripe_subscription_id);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: user.id }, ...(hadTrial ? {} : { trial_period_days: 14 }) },
    success_url: `${env.siteUrl}/billing?checkout=success`,
    cancel_url: `${env.siteUrl}/billing?checkout=cancelled`,
  });
  return ok({ url: session.url });
});
