import type Stripe from "stripe";
import { fail, ok } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { stripe, syncSubscription } from "@/lib/billing/stripe";
import { notify } from "@/lib/engine/notify";

/**
 * Stripe → Facet. Configure in the Stripe dashboard (or `stripe listen --forward-to localhost:3000/api/stripe/webhook`)
 * with: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed.
 */
export async function POST(req: Request) {
  const secret = serverEnv().stripeWebhookSecret;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return fail(400, "Missing signature");
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await req.text(), sig, secret);
  } catch (e) {
    console.warn("[stripe] bad signature", e);
    return fail(400, "Invalid signature");
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.subscription) await syncSubscription(await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id));
        if (s.client_reference_id) await notify(s.client_reference_id, "ok", "Welcome to Facet Pro! Every feature is now unlocked.", "/billing");
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const userId = inv.parent?.subscription_details?.metadata?.user_id;
        if (userId) await notify(userId, "warn", "Your Pro payment failed. Update your card in Billing to keep Pro.", "/billing", { email: true, subject: "Facet payment failed" });
        break;
      }
    }
  } catch (e) {
    console.error("[stripe] handler error", e);
    return fail(500, "Webhook handler failed"); // Stripe retries
  }
  return ok({ received: true });
}
