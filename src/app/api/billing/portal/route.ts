import { ApiError, handle, ok, requireUser } from "@/lib/api";
import { env } from "@/lib/env";
import { billingConfigured, stripe } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = handle(async () => {
  const { user } = await requireUser();
  if (!billingConfigured()) throw new ApiError(503, "Billing isn't configured yet.");
  const { data: sub } = await supabaseAdmin().from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!sub?.stripe_customer_id) throw new ApiError(400, "No billing account yet. Start a trial first.");
  const session = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${env.siteUrl}/billing` });
  return ok({ url: session.url });
});
