-- TradePath starter schema, PostgreSQL / Supabase. Migration draft; review and test before production.
-- All account timestamps UTC; local calendar dates computed using Africa/Nairobi in application.
create extension if not exists pgcrypto;

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 timezone text not null default 'Africa/Nairobi',
 available_minutes integer not null default 90 check (available_minutes between 15 and 240),
 capital_kes numeric(18,2) check (capital_kes >= 0),
 mode text not null default 'demo' check (mode = 'demo'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.strategy_versions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 code text not null default 'H4H1', version integer not null check (version>0),
 params jsonb not null default '{}'::jsonb,
 active_from timestamptz not null default now(), archived_at timestamptz,
 created_at timestamptz not null default now(),
 unique (user_id, code, version), unique (id, user_id)
);
create table public.curriculum_phases (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 phase_number smallint not null check (phase_number between 1 and 6),
 planned_start date not null, planned_end date not null,
 state text not null default 'not_started' check (state in ('not_started','active','needs_practice','completed')),
 verified_at timestamptz, created_at timestamptz not null default now(),
 unique(user_id,phase_number)
);
create table public.daily_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 local_date date not null, emotion text, energy text,
 session_status text not null default 'planned' check(session_status in ('planned','active','study_only','complete','missed')),
 reflection text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,local_date), unique(id,user_id)
);
create table public.daily_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, task_code text not null, state text not null default 'pending'
 check (state in ('pending','done','skipped','missed')),
 skip_reason text, completed_at timestamptz, created_at timestamptz not null default now(),
 foreign key(session_id,user_id) references public.daily_sessions(id,user_id) on delete cascade,
 unique(session_id,task_code)
);
create table public.setups (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 strategy_version_id uuid not null, session_id uuid,
 mode text not null check(mode in ('backtest','demo','free_trial')),
 direction text not null check(direction in ('buy','sell')),
 signal_close_at timestamptz, zone_created_at timestamptz,
 zone_low numeric(14,6), zone_high numeric(14,6),
 candle_open numeric(14,6), candle_high numeric(14,6), candle_low numeric(14,6), candle_close numeric(14,6),
 entry numeric(14,6), stop numeric(14,6), target numeric(14,6), volume_lots numeric(18,5),
 cost_model jsonb not null default '{}'::jsonb,
 eligibility text not null default 'unknown' check (eligibility in ('eligible','ineligible','unknown')),
 rule_snapshot jsonb not null default '{}'::jsonb, failures jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(strategy_version_id,user_id) references public.strategy_versions(id,user_id),
 foreign key(session_id,user_id) references public.daily_sessions(id,user_id),
 unique(id,user_id),
 check(zone_high is null or zone_low is null or zone_high>=zone_low),
 check(entry is null or entry>0), check(stop is null or stop>0), check(target is null or target>0),
 check(volume_lots is null or volume_lots>0)
);
create table public.trades (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 setup_id uuid, mode text not null check (mode in ('backtest','demo','free_trial')),
 side text not null check(side in ('buy','sell')),
 opened_at timestamptz not null, closed_at timestamptz,
 entry numeric(14,6) not null check(entry>0), stop numeric(14,6) not null check(stop>0),
 target numeric(14,6) check(target>0), exit numeric(14,6) check(exit>0),
 volume_lots numeric(18,5) not null check(volume_lots>0),
 cost_usd numeric(18,4) not null default 0 check(cost_usd>=0),
 planned_risk_usd numeric(18,4) not null check(planned_risk_usd>0),
 realised_pnl_usd numeric(18,4), realised_r numeric(18,6),
 rule_compliant boolean, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(setup_id,user_id) references public.setups(id,user_id),
 check((closed_at is null and exit is null and realised_pnl_usd is null and realised_r is null)
   or (closed_at is not null and exit is not null and realised_pnl_usd is not null and realised_r is not null)),
 check(closed_at is null or closed_at>=opened_at)
);
create table public.no_trade_decisions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, setup_id uuid, reason text not null, notes text,
 created_at timestamptz not null default now(),
 foreign key(session_id,user_id) references public.daily_sessions(id,user_id),
 foreign key(setup_id,user_id) references public.setups(id,user_id)
);
create table public.weekly_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 week_start_local_date date not null, facts jsonb not null default '{}'::jsonb,
 commitment text, reviewed_at timestamptz, created_at timestamptz not null default now(),
 unique(user_id,week_start_local_date)
);
create table public.equity_snapshots (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 account_mode text not null check(account_mode in ('demo','free_trial')),
 account_ref text not null, at timestamptz not null,
 balance_usd numeric(18,4) not null, equity_usd numeric(18,4) not null,
 deposits_usd numeric(18,4) not null default 0, withdrawals_usd numeric(18,4) not null default 0,
 created_at timestamptz not null default now(),
 unique(user_id,account_mode,account_ref,at)
);
create table public.funding_evaluations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null, programme text not null, rule_set_version text not null,
 reset_timezone text not null, start_balance_usd numeric(18,2) not null check(start_balance_usd>0),
 rules jsonb not null, status text not null default 'draft',
 self_verified_at timestamptz, created_at timestamptz not null default now()
);
-- Critical append-only forensic records have no end-user insert/update/delete grants.
create table public.gate_evaluations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 setup_id uuid not null, evaluated_at timestamptz not null default now(),
 rules_version text not null, state text not null check(state in ('eligible','ineligible','unknown')),
 reasons jsonb not null default '[]'::jsonb, inputs_hash text not null,
 foreign key(setup_id,user_id) references public.setups(id,user_id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 entity_type text not null, entity_id uuid not null, verb text not null,
 before_hash text, after_jsonb jsonb, occurred_at timestamptz not null default now()
);

-- Explicit privileges; RLS is defense in depth, not a replacement for grants.
revoke all on all tables in schema public from anon;
-- Protect this migration's tables even in a database with liberal legacy public grants.
do $$ declare t text; begin
 foreach t in array array[
 'profiles','strategy_versions','curriculum_phases','daily_sessions','daily_tasks','setups',
 'trades','no_trade_decisions','weekly_reviews','equity_snapshots','funding_evaluations',
 'gate_evaluations','audit_events'] loop
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (user_id=(select auth.uid()))',t);
 end loop;
end $$;
-- Client operations allowed for ordinary, user-editable tables, pending server-side validation.
do $$ declare t text; begin
 foreach t in array array[
 'profiles','strategy_versions','curriculum_phases','daily_sessions','daily_tasks','setups',
 'trades','no_trade_decisions','weekly_reviews','equity_snapshots','funding_evaluations'] loop
  execute format('grant insert, update on public.%I to authenticated',t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check (user_id=(select auth.uid()))',t);
  execute format('create policy owner_update on public.%I for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t);
 end loop;
end $$;
create index trades_user_mode_closed on public.trades(user_id, mode, closed_at desc);
create index setups_user_signal on public.setups(user_id, signal_close_at desc);
create index equity_user_ref_time on public.equity_snapshots(user_id, account_ref, at);
create index events_user_time on public.audit_events(user_id, occurred_at desc);

-- IMPORTANT follow-up migrations prior to production:
-- 1. Make strategy versions immutable after first evaluation; append version rather than editing.
-- 2. Lock calculated trade fields and eligibility to server-owned SECURITY DEFINER RPC with auth checks;
--    block direct client mutations via column grants or dedicated protected functions.
-- 3. Add private screenshot bucket and object ownership policies; signed read URLs.
-- 4. Add server-generated append-only audit/gate events; restrict authenticated writes (already read-only).
-- 5. Add lessons and lesson_progress, sync_operations, import pipeline and deletion workflow.
-- 6. Test all grant/RLS combinations under two users and the anon role.
-- 7. Hardcode no service-role key in browser, and never expose brokerage passwords.
