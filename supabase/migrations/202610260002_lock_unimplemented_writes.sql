-- Fail closed until authenticated, validated RPCs are delivered.
-- RLS owner checks alone do not protect derived fields or historical evidence.
-- This migration intentionally removes draft browser mutation privileges.
do $$ declare t text; begin
 foreach t in array array[
 'profiles','strategy_versions','curriculum_phases','daily_sessions','daily_tasks','setups',
 'trades','no_trade_decisions','weekly_reviews','equity_snapshots','funding_evaluations'] loop
  execute format('revoke insert, update, delete on public.%I from authenticated', t);
  execute format('drop policy if exists owner_insert on public.%I', t);
  execute format('drop policy if exists owner_update on public.%I', t);
 end loop;
end $$;
-- No write RPC is exposed in this increment. Do not restore broad grants.
-- Future functions must validate auth.uid(), derive money/rules on server,
-- append gate/audit events atomically and enforce client-operation idempotency.
