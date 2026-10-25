-- Run against a database with the migration applied:  psql -f supabase/tests/trading.sql
-- Everything runs in a transaction and is rolled back.
begin;
do $$
declare
  uid uuid := gen_random_uuid();
  acc uuid;
  o public.orders;
  tp uuid; sl uuid;
  c numeric; n int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, uid || '@t.test', '{"full_name":"SQL Test"}');
  select id into acc from public.accounts where user_id = uid and kind = 'paper';
  assert acc is not null, 'paper account bootstrapped';

  -- 1. market buy with bracket
  insert into public.orders (account_id, user_id, symbol, side, type, qty, take_profit, stop_loss)
  values (acc, uid, 'AAPL', 'buy', 'market', 10, 110, 95) returning * into o;
  o := public.execute_fill(o.id, 100);
  assert o.status = 'filled', 'buy filled';
  select cash into c from public.accounts where id = acc;
  assert c = 99000, 'cash debited: ' || c;
  select count(*) into n from public.orders where parent_id = o.id and status = 'working';
  assert n = 2, 'two bracket children created';
  select id into tp from public.orders where parent_id = o.id and type = 'limit';
  select id into sl from public.orders where parent_id = o.id and type = 'stop';

  -- 2. second buy averages the price
  insert into public.orders (account_id, user_id, symbol, side, type, qty) values (acc, uid, 'AAPL', 'buy', 'market', 10) returning * into o;
  perform public.execute_fill(o.id, 120);
  assert (select avg_price from public.positions where account_id = acc and symbol = 'AAPL') = 110, 'avg price 110';
  assert (select qty from public.positions where account_id = acc and symbol = 'AAPL') = 20, 'qty 20';

  -- 3. take-profit leg fills (10 shares): sibling stop is cancelled (OCO), position reduced
  o := public.execute_fill(tp, 111);
  assert o.status = 'filled', 'tp filled';
  assert (select status from public.orders where id = sl) = 'cancelled', 'stop cancelled by OCO';
  assert (select realized_pnl from public.fills where order_id = tp) = 10, 'realized pnl (111-110)*10';
  assert (select qty from public.positions where account_id = acc and symbol = 'AAPL') = 10, 'qty 10 left';

  -- 4. cannot sell more than held
  insert into public.orders (account_id, user_id, symbol, side, type, qty) values (acc, uid, 'AAPL', 'sell', 'market', 50) returning * into o;
  o := public.execute_fill(o.id, 100);
  assert o.status = 'rejected', 'oversell rejected';

  -- 5. cannot spend more cash than available
  insert into public.orders (account_id, user_id, symbol, side, type, qty) values (acc, uid, 'NVDA', 'buy', 'market', 100000) returning * into o;
  o := public.execute_fill(o.id, 100);
  assert o.status = 'rejected' and o.reject_reason like 'Insufficient%', 'insufficient funds rejected';

  -- 6. selling the full position removes it and voids remaining sell orders
  insert into public.orders (account_id, user_id, symbol, side, type, qty, limit_price) values (acc, uid, 'AAPL', 'sell', 'limit', 10, 500) returning id into tp;
  insert into public.orders (account_id, user_id, symbol, side, type, qty) values (acc, uid, 'AAPL', 'sell', 'market', 10) returning * into o;
  perform public.execute_fill(o.id, 105);
  assert not exists (select 1 from public.positions where account_id = acc and symbol = 'AAPL'), 'position closed';
  assert (select status from public.orders where id = tp) = 'cancelled', 'dangling sell cancelled';

  -- 7. filling an already-filled order is a no-op (idempotent)
  perform public.execute_fill(o.id, 999);
  assert (select count(*) from public.fills where order_id = o.id) = 1, 'no double fill';

  -- cash check: 100000 -1000 -1200 +1110 +1050 = 99960
  select cash into c from public.accounts where id = acc;
  assert c = 99960, 'final cash ' || c;

  -- 8. reset
  perform public.reset_account(acc);
  assert (select cash from public.accounts where id = acc) = 100000, 'reset cash';
  raise notice 'ALL TRADING TESTS PASSED';
end $$;
rollback;
