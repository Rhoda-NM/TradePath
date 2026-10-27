\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',message;end if;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.complete_onboarding((now() at time zone 'Africa/Nairobi')::date,'Africa/Nairobi',90,null);
select public.save_equity_snapshot('dddddddd-dddd-4ddd-8ddd-dddddddddddd',null,0,'demo','main',now()-interval '1 hour',1000,950,0,0,true,'Broker statement');
select public.save_equity_snapshot('dddddddd-dddd-4ddd-8ddd-dddddddddddd',null,0,'demo','main',now()-interval '1 hour',1000,950,0,0,true,'Broker statement');
select pg_temp.assert_true((select count(*)=1 from public.equity_snapshots),'idempotent equity retry');
do $$declare v_id uuid;begin
 select id into v_id from public.equity_snapshots;
 perform public.save_equity_snapshot(gen_random_uuid(),v_id,0,'demo','main',now()-interval '1 hour',1000,960,0,0,true,'Corrected floating result');
 perform pg_temp.assert_true((select revision=1 and equity_usd=960 from public.equity_snapshots where id=v_id),'audited correction');
 perform pg_temp.assert_true((select count(*)=1 from public.audit_events where entity_id=v_id and verb='corrected' and after_jsonb->'previous'->>'equity_usd'='950.0000'),'original amount retained');
 begin perform public.save_equity_snapshot(gen_random_uuid(),v_id,0,'demo','main',now()-interval '1 hour',1000,999,0,0,true,'Stale');raise exception 'FAILED: stale update';exception when serialization_failure then null;end;
 begin perform public.save_equity_snapshot('dddddddd-dddd-4ddd-8ddd-dddddddddddd',null,0,'demo','main',now()-interval '1 hour',1000,999,0,0,true,'Broker statement');raise exception 'FAILED: reused operation';exception when invalid_parameter_value then null;end;
 begin perform public.save_equity_snapshot(gen_random_uuid(),null,0,'demo','main',now()+interval '1 hour',1000,999,0,0,true,'Future');raise exception 'FAILED: future';exception when invalid_parameter_value then null;end;
 begin perform public.save_equity_snapshot(gen_random_uuid(),null,0,'demo','main',now(),1000,'NaN'::numeric,0,0,true,'NaN');raise exception 'FAILED: NaN';exception when invalid_parameter_value then null;end;
 begin update public.equity_snapshots set equity_usd=9999;raise exception 'FAILED: direct edit';exception when insufficient_privilege then null;end;
end$$;
select public.record_journal_trade(gen_random_uuid(),jsonb_build_object('setupId',null,'mode','demo','side','buy','accountRef','main','openedAt',now(),'entry',1.1,'stop',1.09,'target',1.12,'lots',.01,'costUSD',0,'notes','Trade journal fixture.'));
select public.close_journal_trade(gen_random_uuid(),(select id from public.trades),0,now(),1.099,1,'Loss fixture.');
select pg_temp.assert_true((public.weekly_review_facts(date_trunc('week',now() at time zone 'Africa/Nairobi')::date)->'journal_accounts'->0->>'net_usd')::numeric=-2,'review includes net loss by account');
select pg_temp.assert_true(public.weekly_review_facts(date_trunc('week',now() at time zone 'Africa/Nairobi')::date)->'journal_accounts'->0->>'account_ref'='main','review labels account');
-- Do not permit cross-user IDs or direct access to the renamed internal helper.
select set_config('tradepath.test_equity',(select id::text from public.equity_snapshots),true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true((select count(*)=0 from public.equity_snapshots),'B cannot read A equity');
do $$begin
 begin perform public.save_equity_snapshot(gen_random_uuid(),current_setting('tradepath.test_equity')::uuid,1,'demo','main',now()-interval '1 hour',1000,999,0,0,true,'Other account');raise exception 'FAILED: owner overwrite';exception when insufficient_privilege then null;end;
 begin perform public.weekly_practice_facts(current_date);raise exception 'FAILED: internal helper callable';exception when insufficient_privilege then null;end;
end$$;
reset role;
set role anon;
do $$begin
 begin perform public.save_equity_snapshot(gen_random_uuid(),null,0,'demo','main',now(),1000,1000,0,0,true,'Anon');raise exception 'FAILED: anonymous write';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
\echo 'Equity ownership, conflict, audit and weekly facts checks passed.'
