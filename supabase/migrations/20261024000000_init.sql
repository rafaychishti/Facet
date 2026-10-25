-- ============================================================================
-- Facet: initial schema
-- Simulated trading only. No real money is ever held or moved.
--
-- Security model
--   * Every user-owned table has row-level security (RLS).
--   * Users can READ their own rows directly (via the anon key + their JWT).
--   * Anything that moves simulated money (orders, fills, positions, cash,
--     challenge state) is written ONLY by the server using the service role,
--     through the security-definer functions at the bottom of this file.
--     Clients can never edit their own balance.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  handle text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  country text not null default '',
  avatar_url text,
  public_profile boolean not null default true,
  language text not null default 'en',
  notify_fills boolean not null default true,
  notify_alerts_email boolean not null default true,
  notify_rule_warnings boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── Subscriptions (written by the Stripe webhook only) ─────────────────────
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'none'
    check (status in ('none','trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')),
  price_id text,
  interval text,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();
alter table public.subscriptions enable row level security;
create policy "subscriptions: read own" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.user_id = uid and s.status in ('trialing','active'));
$$;

-- ── Watchlists ──────────────────────────────────────────────────────────────
create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Watchlist' check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create index on public.watchlists (user_id);

create table public.watchlist_items (
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z.\-]{1,10}$'),
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (watchlist_id, symbol)
);

alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
create policy "watchlists: own" on public.watchlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlist_items: own" on public.watchlist_items for all
  using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));

-- ── Simulated accounts ─────────────────────────────────────────────────────
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('paper','challenge','competition')),
  name text not null,
  starting_balance numeric(16,2) not null check (starting_balance > 0),
  cash numeric(16,2) not null,
  last_equity numeric(16,2),               -- refreshed by the worker
  last_equity_at timestamptz,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now()
);
create index on public.accounts (user_id);
alter table public.accounts enable row level security;
create policy "accounts: read own" on public.accounts for select using (auth.uid() = user_id);

create table public.positions (
  account_id uuid not null references public.accounts (id) on delete cascade,
  symbol text not null,
  qty numeric(16,4) not null check (qty > 0),
  avg_price numeric(16,4) not null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, symbol)
);
alter table public.positions enable row level security;
create policy "positions: read own" on public.positions for select
  using (exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  type text not null check (type in ('market','limit','stop','stop_limit')),
  qty numeric(16,4) not null check (qty > 0),
  limit_price numeric(16,4),
  stop_price numeric(16,4),
  stop_triggered boolean not null default false,
  take_profit numeric(16,4),
  stop_loss numeric(16,4),
  parent_id uuid references public.orders (id) on delete cascade, -- bracket children (OCO pair)
  status text not null default 'working' check (status in ('working','filled','cancelled','rejected')),
  filled_price numeric(16,4),
  filled_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);
create index on public.orders (account_id, created_at desc);
create index orders_working_idx on public.orders (status) where status = 'working';
alter table public.orders enable row level security;
create policy "orders: read own" on public.orders for select using (auth.uid() = user_id);

create table public.fills (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  symbol text not null,
  side text not null,
  qty numeric(16,4) not null,
  price numeric(16,4) not null,
  realized_pnl numeric(16,2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.fills (account_id, created_at desc);
alter table public.fills enable row level security;
create policy "fills: read own" on public.fills for select
  using (exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));

create table public.equity_snapshots (
  account_id uuid not null references public.accounts (id) on delete cascade,
  day date not null,
  balance numeric(16,2) not null,   -- cash + positions at cost
  equity numeric(16,2) not null,    -- cash + positions at market
  primary key (account_id, day)
);
alter table public.equity_snapshots enable row level security;
create policy "snapshots: read own" on public.equity_snapshots for select
  using (exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));

-- ── Challenges ─────────────────────────────────────────────────────────────
create table public.challenge_plans (
  id text primary key,
  name text not null,
  size numeric(16,2) not null,
  profit_target_pct numeric(5,2) not null,    -- phase 1
  phase2_target_pct numeric(5,2) not null,
  max_daily_loss_pct numeric(5,2) not null,
  max_drawdown_pct numeric(5,2) not null,
  min_days int not null,
  pro_only boolean not null default false,
  sort int not null default 0
);
alter table public.challenge_plans enable row level security;
create policy "plans: public read" on public.challenge_plans for select using (true);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('FCT-' || lpad((floor(random() * 1000000))::int::text, 6, '0')),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.challenge_plans (id),
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  phase int not null default 1 check (phase in (1,2,3)), -- 3 = simulated funded stage
  status text not null default 'active' check (status in ('active','passed','failed')),
  phase_start_balance numeric(16,2) not null,
  day_start_balance numeric(16,2) not null,  -- reset at 4 PM ET
  low_equity numeric(16,2) not null,
  best_day numeric(16,2) not null default 0,
  worst_day numeric(16,2) not null default 0,
  trading_days int not null default 0,
  last_trade_day date,
  fail_reason text,
  started_at timestamptz not null default now(),
  phase_started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.challenges (user_id, started_at desc);
alter table public.challenges enable row level security;
create policy "challenges: read own" on public.challenges for select using (auth.uid() = user_id);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('CERT-' || upper(substr(md5(random()::text), 1, 8))),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete set null,
  title text not null,
  detail text not null,
  holder_name text not null,
  issued_at timestamptz not null default now()
);
alter table public.certificates enable row level security;
create policy "certificates: read own" on public.certificates for select using (auth.uid() = user_id);

create table public.sim_payouts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('PO-' || lpad((floor(random() * 100000))::int::text, 5, '0')),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  amount numeric(16,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
alter table public.sim_payouts enable row level security;
create policy "payouts: read own" on public.sim_payouts for select using (auth.uid() = user_id);

-- ── Competitions ───────────────────────────────────────────────────────────
create table public.competitions (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  size numeric(16,2) not null,
  prize text not null,
  pro_only boolean not null default false
);
alter table public.competitions enable row level security;
create policy "competitions: public read" on public.competitions for select using (true);

create table public.competition_entries (
  competition_id text not null references public.competitions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);
alter table public.competition_entries enable row level security;
create policy "entries: read own" on public.competition_entries for select using (auth.uid() = user_id);

-- Public leaderboard. A security-definer FUNCTION (not a view) so it can rank
-- everyone's competition accounts while returning only safe, aggregate columns:
-- no user ids, emails or account ids leave the database. Opted-out users are hidden.
create or replace function public.get_leaderboard(p_competition_id text, p_limit int default 100)
returns table (rank bigint, name text, handle text, country text, equity numeric, return_pct numeric, trades bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select
    row_number() over (order by (coalesce(a.last_equity, a.cash) - a.starting_balance) / a.starting_balance desc) as rank,
    coalesce(nullif(p.full_name, ''), 'Anonymous') as name,
    p.handle,
    p.country,
    coalesce(a.last_equity, a.cash) as equity,
    round(((coalesce(a.last_equity, a.cash) - a.starting_balance) / a.starting_balance) * 100, 2) as return_pct,
    (select count(*) from public.fills f where f.account_id = a.id) as trades,
    e.user_id = (select auth.uid()) as is_me
  from public.competition_entries e
  join public.accounts a on a.id = e.account_id
  join public.profiles p on p.id = e.user_id
  where e.competition_id = p_competition_id
    and (p.public_profile or e.user_id = (select auth.uid()))
  order by rank
  limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function public.get_leaderboard(text, int) from public, anon;
grant execute on function public.get_leaderboard(text, int) to authenticated, service_role;

-- ── Alerts & notifications ─────────────────────────────────────────────────
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z.\-]{1,10}$'),
  condition text not null check (condition in ('price_above','price_below','pct_change_above','pct_change_below')),
  value numeric(16,4) not null,
  status text not null default 'active' check (status in ('active','triggered','paused')),
  notify_email boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.alerts (status);
alter table public.alerts enable row level security;
create policy "alerts: read own" on public.alerts for select using (auth.uid() = user_id);
create policy "alerts: delete own" on public.alerts for delete using (auth.uid() = user_id);
create policy "alerts: update own" on public.alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- inserts go through the API so the free-plan limit is enforced server-side

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tone text not null default 'info' check (tone in ('info','ok','warn','error')),
  text text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: read own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications: mark read" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Affiliate & contact ────────────────────────────────────────────────────
create table public.affiliate_applications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  website text not null default '',
  audience text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  ref_code text unique,
  created_at timestamptz not null default now()
);
alter table public.affiliate_applications enable row level security;
create policy "affiliate: read own" on public.affiliate_applications for select using (auth.uid() = user_id);
create policy "affiliate: apply" on public.affiliate_applications for insert with check (auth.uid() = user_id and status = 'pending' and ref_code is null);

create table public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) <= 120),
  email text not null check (char_length(email) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
-- written by the API route with the service role (rate-limited there)

-- ── New user bootstrap ─────────────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wl uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));

  insert into public.accounts (user_id, kind, name, starting_balance, cash)
  values (new.id, 'paper', 'Paper account', 100000, 100000);

  insert into public.watchlists (user_id, name) values (new.id, 'Watchlist') returning id into wl;
  insert into public.watchlist_items (watchlist_id, symbol, position)
  select wl, s, ord from unnest(array['AAPL','NVDA','MSFT','TSLA','AMZN','META']) with ordinality as t(s, ord);

  insert into public.subscriptions (user_id) values (new.id);
  insert into public.notifications (user_id, tone, text, link)
  values (new.id, 'ok', 'Welcome to Facet! Your $100,000 paper account is ready.', '/terminal');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- Trading functions (service role only)
-- ============================================================================

-- Execute a fill for an order at a given price. Atomic and race-safe:
-- the account row is locked, so two fills on one account can never interleave.
-- Long-only (no shorting, no margin), like a cash brokerage account.
create or replace function public.execute_fill(p_order_id uuid, p_price numeric)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  acc public.accounts;
  pos public.positions;
  cost numeric;
  realized numeric := 0;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if o.status <> 'working' then return o; end if;

  select * into acc from public.accounts where id = o.account_id for update;
  if acc.status <> 'active' then
    update public.orders set status = 'rejected', reject_reason = 'Account is closed' where id = o.id returning * into o;
    return o;
  end if;

  select * into pos from public.positions where account_id = o.account_id and symbol = o.symbol for update;
  cost := round(o.qty * p_price, 2);

  if o.side = 'buy' then
    if cost > acc.cash then
      update public.orders set status = 'rejected', reject_reason = 'Insufficient buying power' where id = o.id returning * into o;
      return o;
    end if;
    update public.accounts set cash = cash - cost where id = acc.id;
    if pos.symbol is null then
      insert into public.positions (account_id, symbol, qty, avg_price) values (acc.id, o.symbol, o.qty, p_price);
    else
      update public.positions
        set avg_price = round((pos.avg_price * pos.qty + p_price * o.qty) / (pos.qty + o.qty), 4),
            qty = pos.qty + o.qty, updated_at = now()
        where account_id = acc.id and symbol = o.symbol;
    end if;
  else
    if pos.symbol is null or pos.qty < o.qty then
      update public.orders set status = 'rejected', reject_reason = 'Not enough shares to sell (short selling is not supported)' where id = o.id returning * into o;
      return o;
    end if;
    realized := round((p_price - pos.avg_price) * o.qty, 2);
    update public.accounts set cash = cash + cost where id = acc.id;
    if pos.qty = o.qty then
      delete from public.positions where account_id = acc.id and symbol = o.symbol;
      -- position is gone, so any remaining protective orders for it are void
      update public.orders set status = 'cancelled'
        where account_id = acc.id and symbol = o.symbol and status = 'working' and side = 'sell' and id <> o.id;
    else
      update public.positions set qty = pos.qty - o.qty, updated_at = now() where account_id = acc.id and symbol = o.symbol;
    end if;
  end if;

  update public.orders set status = 'filled', filled_price = p_price, filled_at = now() where id = o.id returning * into o;
  insert into public.fills (order_id, account_id, symbol, side, qty, price, realized_pnl)
  values (o.id, o.account_id, o.symbol, o.side, o.qty, p_price, realized);

  -- OCO: one bracket leg filled, cancel its sibling
  if o.parent_id is not null then
    update public.orders set status = 'cancelled' where parent_id = o.parent_id and id <> o.id and status = 'working';
  end if;

  -- Bracket: parent buy filled, create take-profit (limit) and stop-loss (stop) children
  if o.side = 'buy' and o.parent_id is null then
    if o.take_profit is not null then
      insert into public.orders (account_id, user_id, symbol, side, type, qty, limit_price, parent_id)
      values (o.account_id, o.user_id, o.symbol, 'sell', 'limit', o.qty, o.take_profit, o.id);
    end if;
    if o.stop_loss is not null then
      insert into public.orders (account_id, user_id, symbol, side, type, qty, stop_price, parent_id)
      values (o.account_id, o.user_id, o.symbol, 'sell', 'stop', o.qty, o.stop_loss, o.id);
    end if;
  end if;

  return o;
end $$;

-- Reset a paper account back to its starting balance.
create or replace function public.reset_account(p_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.accounts where id = p_account_id for update;
  update public.orders set status = 'cancelled' where account_id = p_account_id and status = 'working';
  delete from public.positions where account_id = p_account_id;
  delete from public.equity_snapshots where account_id = p_account_id;
  update public.accounts set cash = starting_balance, last_equity = starting_balance, last_equity_at = now() where id = p_account_id;
end $$;

-- Only the server (service role) may call money-moving functions.
revoke all on function public.execute_fill(uuid, numeric) from public, anon, authenticated;
revoke all on function public.reset_account(uuid) from public, anon, authenticated;
grant execute on function public.execute_fill(uuid, numeric) to service_role;
grant execute on function public.reset_account(uuid) to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ── Seed reference data ────────────────────────────────────────────────────
insert into public.challenge_plans (id, name, size, profit_target_pct, phase2_target_pct, max_daily_loss_pct, max_drawdown_pct, min_days, pro_only, sort) values
  ('starter',  'Starter',  25000,  8, 4, 4, 8,  5, false, 1),
  ('standard', 'Standard', 100000, 10, 5, 5, 10, 5, true,  2),
  ('expert',   'Expert',   200000, 10, 5, 4, 8,  10, true, 3)
on conflict (id) do nothing;

insert into public.competitions (id, name, starts_at, ends_at, size, prize, pro_only) values
  ('2026-10-sprint', 'October Sprint', '2026-10-01 13:30+00', '2026-10-31 20:00+00', 100000, 'Lifetime Pro + certificate', false),
  ('2026-11-sprint', 'November Sprint', '2026-11-02 14:30+00', '2026-11-30 21:00+00', 100000, 'Lifetime Pro + certificate', false),
  ('2026-12-earnings', 'Year-End Cup', '2026-12-01 14:30+00', '2026-12-31 21:00+00', 50000, '1 year of Pro', true)
on conflict (id) do nothing;
