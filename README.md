# Facet

Chart, paper-trade and prove your edge. Facet is a simulated trading platform for US stocks with TradingView-depth charts, a $100K paper account, prop-style trading challenges and competitions. **No real money is involved anywhere.**

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, TradingView Lightweight Charts 5, three.js / react-three-fiber
- **Backend:** Next.js route handlers, Supabase (Postgres + Auth + row-level security), a background worker
- **Data:** Alpaca (live prices + chart bars, IEX feed) and Finnhub (news, search, profiles). Demo prices are used automatically when no keys are set.
- **Billing:** Stripe subscriptions (test mode), 14-day trial
- **Hosting:** Docker + Nginx on your VPS

---

## 1. Run it locally (Windows)

Needs Node.js 20.9+ (22 LTS recommended).

### a) Create a Supabase project (free, about 5 minutes)

1. Go to https://supabase.com → **New project**. Pick a region close to your users and save the database password.
2. Open **SQL Editor** → **New query**, paste the whole of `supabase/migrations/20261024000000_init.sql`, then click **Run**.
3. **Authentication → Providers → Email**: for local testing you can turn off "Confirm email". Turn it back on before launch.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/**`
5. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.

> If you have Docker Desktop you can instead run Supabase locally with `npx supabase start`. It applies the migration automatically.

### b) Configure and start

```powershell
cd facet
copy .env.example .env.local
# edit .env.local: paste the 3 Supabase values and set CRON_SECRET to any long random string
npm install
npm run dev
```

In a **second terminal**, start the engine (it fills limit/stop orders, checks challenge rules and alerts, and takes the 4 PM ET snapshot):

```powershell
npm run worker
```

Open http://localhost:3000 and create an account. You get a $100,000 paper account and a starter watchlist.

### c) Optional keys

| Feature | What to set | Where to get it |
|---|---|---|
| Live prices + real charts | `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY` | app.alpaca.markets → Paper Trading → API Keys (free) |
| Real news, search, company profiles | `FINNHUB_API_KEY` | finnhub.io → Dashboard (free) |
| Pro subscriptions | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_WEBHOOK_SECRET` | See section 3 |
| Emails for alerts and challenge results | `RESEND_API_KEY`, `EMAIL_FROM` | resend.com (free tier) |
| Google sign-in | Configure in Supabase → Authentication → Providers → Google | Google Cloud Console OAuth client |

Without market keys the app shows a **Demo prices** badge and uses simulated prices that move during the day, so you can test everything offline.

---

## 2. How it works

```
Browser ── pages (client components + SWR) ──► /api/* route handlers ──► Supabase Postgres (RLS)
                                                   │                          ▲
                                                   ├─► market facade ─► Alpaca / Finnhub (cached)
                                                   │
worker (npm run worker, every 20s) ──► engine: match orders · check challenges · alerts · equity · EOD
```

**Security model**

- Every table has row-level security. With the public anon key, users can only **read** their own rows.
- Anything that moves simulated money goes through the server using the service-role key, after `requireUser()` has verified the session with Supabase Auth. That covers orders, fills, positions, cash and challenge state.
- Fills run in the `execute_fill()` Postgres function. It locks the account row, so fills are atomic and race-free. It's long-only (no shorting or margin), handles OCO bracket children, and is idempotent.
- Public market endpoints are cached and rate-limited per IP. Pro limits (alerts, watchlist size, Pro challenges and competitions) are enforced on the server.

**Trading rules**

- Market orders fill instantly during regular hours (9:30 AM–4:00 PM ET, holidays included). Outside hours they queue for the open. Set `FACET_ALLOW_EXTENDED_FILLS=true` to fill any time in development.
- Limit, stop and stop-limit orders are matched by the worker. A take-profit/stop-loss bracket creates an OCO pair when the entry fills.

**Challenges**

- Phase 1 (target %) → Phase 2 (half the target) → simulated funded stage.
- Daily loss is measured from equity at the last 4 PM ET close. Max drawdown is static, from the phase's starting balance. Both are checked after every fill and on every worker tick.
- Passing a phase issues a certificate. In the funded stage you can record a simulated payout (80% split, every 14 days).

### Project layout

```
supabase/migrations/   schema, RLS, trading functions, seed data
supabase/tests/        SQL tests for the fill engine
src/app/(marketing)/   landing, pricing, setup
src/app/(auth)/        login, signup, forgot/reset password
src/app/(app)/         the product (overview, terminal, markets, symbol, portfolio, alerts, challenges, leaderboard, ...)
src/app/api/           route handlers (market, orders, accounts, challenges, billing, webhooks, cron)
src/lib/engine/        rules (pure, unit-tested), core engine, notifications
src/lib/market/        Alpaca + Finnhub clients, demo provider, cache, market hours
src/lib/hooks.ts       client data hooks (SWR)
src/proxy.ts           session refresh + redirects for signed-out users
worker/index.ts        background engine loop
```

---

## 3. Stripe (test mode)

1. In the Stripe dashboard (test mode) create a product **Facet Pro** with a recurring price of **$20/month**, and optionally **$192/year**. Copy the `price_...` IDs into `.env.local`.
2. Copy your `sk_test_...` secret key into `STRIPE_SECRET_KEY`.
3. Forward webhooks locally with the Stripe CLI:
   ```powershell
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Put the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
4. In production, add a webhook endpoint at `https://YOUR-DOMAIN/api/stripe/webhook` for these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Turn on the **Customer portal** (Settings → Billing → Customer portal).

Test card: `4242 4242 4242 4242`, any future date, any CVC. Live keys are refused unless `FACET_ALLOW_LIVE_STRIPE=true`, which is a safety net while you choose your live payment provider.

---

## 4. Deploy to your VPS

```bash
git clone <your repo> facet && cd facet
cp .env.example .env        # fill in production values; FACET_ALLOW_EXTENDED_FILLS=false
docker compose up -d --build
```

This starts two containers from one image: `web` (port 3000, bound to localhost) and `worker`. Put Nginx in front using `deploy/nginx.conf`, then add HTTPS with `certbot --nginx`.

Before going live:
- In Supabase, set the Site URL and Redirect URLs to your domain.
- Turn email confirmation back on in Supabase.

`NEXT_PUBLIC_*` variables are baked in at build time, so rebuild after changing them.

No worker container? Call the engine from cron instead:
`* * * * * curl -s -X POST -H "authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/tick`

---

## 5. Tests

```bash
npm test             # unit tests: fill rules, challenge rules, bracket validation, provider parsers, market hours
npm run typecheck
npm run lint
npm run test:db      # SQL tests for execute_fill (set DATABASE_URL to a database with the migration applied)
```

## 6. Adding admin data

Competitions and challenge plans live in the `competitions` and `challenge_plans` tables. Add a new monthly competition from the Supabase table editor.

Approve affiliate applications by setting `status = 'approved'` and a `ref_code` in `affiliate_applications`. Contact-form messages land in `contact_messages`.

## Licences

Charts use TradingView Lightweight Charts™ (Apache 2.0). Keep `attributionLogo: true`, which is the required attribution.
