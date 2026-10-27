\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',message;end if;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.complete_onboarding((now() at time zone 'Africa/Nairobi')::date,'Africa/Nairobi',90,null);
select public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,'I stayed patient and reviewed H4 structure.','');
select public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,'I stayed patient and reviewed H4 structure.','');
select pg_temp.assert_true((select reflection='I stayed patient and reviewed H4 structure.' from public.daily_sessions),'daily remarks persisted');
select pg_temp.assert_true((select count(*)=1 from public.audit_events where verb='remarks_updated'),'same-value retry produces one audit');
do $$begin
 begin perform public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,'A stale edit must not overwrite the first remark.','');raise exception 'FAILED: stale remark overwrite';exception when serialization_failure then null;end;
 begin perform public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date-1,'Wrong date.','');raise exception 'FAILED: wrong date allowed';exception when invalid_parameter_value then null;end;
 begin perform public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,repeat('x',6001),'');raise exception 'FAILED: oversized remarks allowed';exception when invalid_parameter_value then null;end;
end$$;
select public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,'Updated reflection.','I stayed patient and reviewed H4 structure.');
select pg_temp.assert_true((select count(*)=0 from public.trades),'remarks never create trades');
select pg_temp.assert_true((select count(*)=0 from public.daily_tasks where state='done'),'remarks do not automatically mark tasks done');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true((select count(*)=0 from public.daily_sessions),'B cannot read A remarks');
select public.complete_onboarding((now() at time zone 'Africa/Nairobi')::date,'Africa/Nairobi',90,null);
select public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,'Independent B reflection.','');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.assert_true((select reflection='Updated reflection.' from public.daily_sessions),'B cannot change A remarks');
select public.save_daily_remarks((now() at time zone 'Africa/Nairobi')::date,'','Updated reflection.');
select pg_temp.assert_true((select reflection is null from public.daily_sessions),'owner can clear current remarks');
select pg_temp.assert_true(exists(select 1 from public.audit_events where verb='remarks_updated' and after_jsonb->>'previous_remarks'='Updated reflection.'),'prior remarks retained in audit after clear');
reset role;
set role anon;
do $$begin
 begin perform public.save_daily_remarks(current_date,'Unauthenticated remark.','');raise exception 'FAILED: anonymous remarks write';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
\echo 'Daily journal remarks database checks passed.'
