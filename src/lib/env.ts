/** Central place for environment flags. Server-only values are never exposed to the browser. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const serverEnv = () => ({
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  finnhubKey: process.env.FINNHUB_API_KEY ?? "",
  alpacaKey: process.env.ALPACA_API_KEY_ID ?? "",
  alpacaSecret: process.env.ALPACA_API_SECRET_KEY ?? "",
  stripeSecret: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  stripePriceYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  resendKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Facet <alerts@example.com>",
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Fill orders outside US market hours. Handy in development; keep false in production. */
  allowExtendedFills: process.env.FACET_ALLOW_EXTENDED_FILLS === "true",
});

export const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
