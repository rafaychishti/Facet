# Facet: build plan

Decisions locked:

- **Product:** TradingView/Robinhood-style app for **US stocks only**. Simulated trading only, no AI features.
- **Challenges:** simulated only. No real money, entry fees or payouts. Payouts are a scorekeeping screen.
- **Revenue:** Free + Pro ($20/mo, $192/yr) with a 14-day trial. **Stripe in test mode**; pick the live provider before launch.
- **Data:** Alpaca IEX (prices + bars) + Finnhub (news, search, profiles). Demo provider when keys are missing.
- **Hosting:** own VPS, Docker Compose (web + worker) behind Nginx.

| # | Stage | Status |
|---|---|---|
| 1 | Setup: Next.js, TypeScript, Tailwind, env, git | ✅ |
| 2 | Design system + every screen | ✅ |
| 3 | Market data layer: Alpaca/Finnhub clients, caching, per-IP rate limits, demo fallback | ✅ |
| 4 | Charting: live candles, indicators, drawings, position/order lines on chart | ✅ (multi-chart layouts: later) |
| 5 | Auth + database: Supabase Auth (email, Google, reset), proxy redirects, full schema with RLS | ✅ |
| 6 | Paper-trading engine: atomic fills, market hours, limit/stop/stop-limit, OCO brackets, worker | ✅ |
| 7 | Challenges: rules engine, phases, EOD snapshots, certificates, payouts (sim), competitions + leaderboard | ✅ |
| 8 | Billing: Stripe Checkout + trial, webhooks, portal, Pro gating | ✅ (test mode) |
| 9 | Landing polish: contact form (stored), SEO basics | ✅ (Urdu i18n: later) |
| 10 | Deploy + QA: Dockerfile, compose, Nginx, CI, unit + SQL + end-to-end tests | ✅ ready, not yet deployed |

## Verified end to end

33 browser checks passed against a local Supabase stack. They covered:
- signup and login redirects
- market, limit and bracket orders, and oversell rejection
- watchlist
- alerts: trigger, plus the free-plan limit
- notifications
- challenge start, trading days, phase pass and certificate, daily-loss fail
- end-of-day snapshots
- competition join and leaderboard
- profile save
- billing without keys
- isolation between users (no cross-account reads or trades)
- contact form
- sign out

## Next gaps to close (production checklist)

- Live data keys + verify Alpaca/Finnhub free-tier limits under real load
- Email provider (Resend) + Supabase SMTP for auth emails
- Live payment provider decision (Stripe via US entity, Paddle, or Lemon Squeezy)
- Error tracking (Sentry free tier) and uptime monitoring
- Legal pages (Terms, Privacy, Risk disclaimer)
- Websocket price streaming (currently 15 s polling) and multi-chart layouts
- Admin screen for competitions / affiliate approvals (currently via Supabase table editor)
- Database backups: the free plan has limited backups, so schedule a regular pg_dump export
