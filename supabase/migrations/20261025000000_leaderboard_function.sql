-- Fix for Supabase Security Advisor: "Security Definer View: public.leaderboard".
-- Replaces the view with a security-definer function that returns only
-- aggregate, non-identifying columns. Safe to run more than once.

drop view if exists public.leaderboard;

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

-- Also clears the "Function Search Path Mutable" warning on the timestamp trigger
alter function public.set_updated_at() set search_path = '';
