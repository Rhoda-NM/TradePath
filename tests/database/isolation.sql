\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAILED: %',message; end if; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.complete_onboarding(date '2026-10-26','Africa/Nairobi',90,null);
select public.complete_onboarding(date '2026-10-26','Africa/Nairobi',60,10000);
select pg_temp.assert_true((select count(*)=6 from public.curriculum_phases),'idempotent six phases');
select pg_temp.assert_true((select count(*)=1 from public.strategy_versions),'idempotent strategy');
select pg_temp.assert_true((select available_minutes=60 from public.profiles),'editable preferences');
select public.ensure_practice_day((now() at time zone 'Africa/Nairobi')::date);
select public.ensure_practice_day((now() at time zone 'Africa/Nairobi')::date);
select pg_temp.assert_true((select count(*)=1 from public.daily_sessions),'one session per local day');
select public.set_practice_task((now() at time zone 'Africa/Nairobi')::date,(select task_code from public.daily_tasks limit 1),true,0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select public.set_practice_task((now() at time zone 'Africa/Nairobi')::date,(select task_code from public.daily_tasks where state='done' limit 1),true,0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select pg_temp.assert_true((select count(*)=1 from public.daily_tasks where state='done'),'safe task retry');
select pg_temp.assert_true((select revision=1 from public.daily_tasks where state='done'),'one revision on exact retry');
do $$begin
 begin perform public.set_practice_task((now() at time zone 'Africa/Nairobi')::date,(select task_code from public.daily_tasks where state='done' limit 1),false,0,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');raise exception 'FAILED: stale task edit allowed';exception when serialization_failure then null;end;
end $$;
select public.check_in_practice((now() at time zone 'Africa/Nairobi')::date,'Fatigued');
select pg_temp.assert_true((select session_status='study_only' from public.daily_sessions),'fatigued defaults study only');
select public.record_no_trade((now() at time zone 'Africa/Nairobi')::date,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','No qualifying setup','Waiting for confirmation');
select public.record_no_trade((now() at time zone 'Africa/Nairobi')::date,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','No qualifying setup','Waiting for confirmation');
select pg_temp.assert_true((select count(*)=1 from public.no_trade_decisions),'idempotent decision');
select pg_temp.assert_true((select count(*)=1 from public.audit_events where entity_type='no_trade_decision'),'one immutable decision audit');
do $$begin
 begin perform public.record_no_trade((now() at time zone 'Africa/Nairobi')::date,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','No qualifying setup','Different payload');raise exception 'FAILED: replay mismatch allowed';exception when invalid_parameter_value then null;end;
 begin perform public.ensure_practice_day((now() at time zone 'Africa/Nairobi')::date-1);raise exception 'FAILED: wrong day allowed';exception when invalid_parameter_value then null;end;
 begin perform public.set_practice_task((now() at time zone 'Africa/Nairobi')::date,'Made-up task',true,0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');raise exception 'FAILED: unknown task allowed';exception when invalid_parameter_value then null;end;
 begin perform public.complete_onboarding(date '2026-10-26','Invalid/Timezone',90,null);raise exception 'FAILED: invalid timezone allowed';exception when invalid_parameter_value then null;end;
 begin perform public.complete_onboarding(date '2026-10-27','Africa/Nairobi',90,null);raise exception 'FAILED: original start date changed';exception when invalid_parameter_value then null;end;
 begin update public.profiles set mode='demo';raise exception 'FAILED: direct profile mutation allowed';exception when insufficient_privilege then null;end;
 begin insert into public.audit_events(user_id,entity_type,entity_id,verb) values(auth.uid(),'test',auth.uid(),'spoof');raise exception 'FAILED: audit injection allowed';exception when insufficient_privilege then null;end;
 begin perform tradepath_private.ensure_day(current_date);raise exception 'FAILED: private helper exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true((select count(*)=0 from public.profiles),'B cannot read A profile');
select pg_temp.assert_true((select count(*)=0 from public.daily_sessions),'B cannot read A sessions');
select pg_temp.assert_true((select count(*)=0 from public.daily_tasks),'B cannot read A tasks');
select pg_temp.assert_true((select count(*)=0 from public.no_trade_decisions),'B cannot read A decisions');
select pg_temp.assert_true((select count(*)=0 from public.audit_events),'B cannot read A audit');
select public.complete_onboarding(date '2026-10-26','UTC',120,null);
select public.ensure_practice_day((now() at time zone 'UTC')::date);
select public.record_no_trade((now() at time zone 'UTC')::date,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Study-only session','Independent B decision');
select pg_temp.assert_true((select count(*)=1 from public.no_trade_decisions),'operation IDs scoped by user');
select pg_temp.assert_true((select count(*)=6 from public.curriculum_phases),'B has independent phases');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.assert_true((select notes='Waiting for confirmation' from public.no_trade_decisions),'A records unaffected by B');
select pg_temp.assert_true((select count(*)=0 from public.profiles where user_id='22222222-2222-4222-8222-222222222222'),'guessed B identifier denied');
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin perform public.complete_onboarding(date '2026-10-26','UTC',90,null);raise exception 'FAILED: missing identity allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role anon;
do $$begin
 begin perform public.ensure_practice_day(current_date);raise exception 'FAILED: anon RPC allowed';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.profiles;raise exception 'FAILED: anon profile read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.assert_true(not exists(select 1 from pg_tables where schemaname='public' and tablename in ('profiles','strategy_versions','curriculum_phases','daily_sessions','daily_tasks','setups','trades','no_trade_decisions','weekly_reviews','equity_snapshots','funding_evaluations','gate_evaluations','audit_events') and not rowsecurity),'RLS enabled on every account table');
rollback;
\echo 'Database isolation checks passed: two users, anonymous access, grants, idempotency and validation.'
