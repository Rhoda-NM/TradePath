\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',message;end if;end$$;
create function pg_temp.setup_fixture(v_side text default 'buy',v_signal timestamptz default now()-interval '120 days') returns jsonb language plpgsql as $$
declare bars jsonb:='[]';i integer;b numeric;v_close numeric;v_high numeric;v_low numeric;pattern numeric[]:=array[0,.002,.004,.006,.004,.002,0,-.002,-.004,-.002,0,.002];p jsonb;
begin
 for i in 0..59 loop
  b:=1.05+floor(i::numeric/12)*.005+pattern[mod(i,12)+1];v_close:=case when v_side='buy' then b else 2.2-b end;v_high:=v_close+.0005;v_low:=v_close-.0005;
  bars:=bars||jsonb_build_array(jsonb_build_object('at',v_signal-interval '30 minutes'-make_interval(hours=>(60-i)*4),'open',v_close,'high',v_high,'low',v_low,'close',v_close));
 end loop;
 p:=jsonb_build_object('mode','backtest','side',v_side,'accountRef','historical-main','dataset','development','decisionAt',v_signal,'h4Candles',bars,'signalCloseAt',v_signal,'zoneCreatedAt',v_signal-interval '2 hours','zoneTestedAt',v_signal-interval '30 minutes','zoneLow',1.0653,'zoneHigh',1.0657,'open',1.0658,'high',1.067,'low',1.0653,'close',1.0668,'entry',1.0668,'stop',1.0651,'target',1.0702,'lots',.1,'entryAt',v_signal,'nextH1Open',1.0668,'equity',10000,'currency','USD','rate',null,'equityAt',v_signal-interval '10 minutes','rateAt',null,'rateSource','','pipCost',1,'commission',0,'minLot',.01,'lotStep',.01,'news','clear','newsCheckedAt',v_signal-interval '10 minutes','newsEvents','[]'::jsonb,'notes','Historical candidate recorded sequentially.');
 if v_side='sell' then p:=p||jsonb_build_object('zoneLow',1.1343,'zoneHigh',1.1347,'open',1.1342,'high',1.1347,'low',1.133,'close',1.1332,'entry',1.1332,'stop',1.1349,'target',1.1298,'nextH1Open',1.1332);end if;
 return p;
end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.complete_onboarding((now() at time zone 'Africa/Nairobi')::date,'Africa/Nairobi',90,null);
select public.evaluate_and_save_setup('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.setup_fixture());
select public.evaluate_and_save_setup('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.setup_fixture());
select pg_temp.assert_true((select count(*)=1 from public.setups),'setup retry idempotent');
select pg_temp.assert_true((select eligibility='eligible' from public.setups),'complete BUY gate eligible');
select pg_temp.assert_true((select length(inputs_hash)=64 from public.gate_evaluations),'SHA256 evaluation hash persisted');
select public.evaluate_and_save_setup(gen_random_uuid(),pg_temp.setup_fixture('sell',now()-interval '119 days'));
select pg_temp.assert_true((select eligibility='eligible' from public.setups where direction='sell'),'SELL gate eligible');
do $$declare p jsonb;s uuid;r jsonb;i integer;changes jsonb[]:=array[
 '{"h4Candles":[]}'::jsonb,'{"news":"unknown"}'::jsonb,'{"newsCheckedAt":null}'::jsonb,'{"entry":null}'::jsonb
];begin
 foreach r in array changes loop
  p:=pg_temp.setup_fixture()||r;
  p:=p||jsonb_build_object('mode','demo','dataset',null,'decisionAt',null);
  s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
  if (select eligibility from public.setups where id=s)='eligible' then raise exception 'FAILED: missing evidence passed';end if;
 end loop;
 p:=pg_temp.setup_fixture();p:=p||jsonb_build_object('signalCloseAt',now()+interval '1 hour');
 s:=public.evaluate_and_save_setup(gen_random_uuid(),p||'{"mode":"demo","dataset":null}');
 perform pg_temp.assert_true((select eligibility='ineligible' from public.setups where id=s),'open H1 rejected');
 p:=pg_temp.setup_fixture('buy',now()-interval '118 days')||'{"close":1.065,"open":1.065,"high":1.065,"low":1.065}';
 s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
 perform pg_temp.assert_true((select eligibility='ineligible' from public.setups where id=s),'zero-range H1 rejected');
 p:=pg_temp.setup_fixture('buy',now()-interval '117 days');p:=p||jsonb_build_object('zoneCreatedAt',now());
 s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
 perform pg_temp.assert_true((select eligibility='ineligible' from public.setups where id=s),'late zone rejected');
 p:=pg_temp.setup_fixture('buy',now()-interval '116 days');p:=p||jsonb_build_object('newsEvents',jsonb_build_array(p->>'signalCloseAt'));
 s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
 perform pg_temp.assert_true((select eligibility='ineligible' from public.setups where id=s),'30-minute news exclusion');
 p:=pg_temp.setup_fixture('buy',now()-interval '115 days')||'{"equity":10000,"currency":"KES","rate":129.89,"lots":0.01,"rateSource":"manual"}';p:=p||jsonb_build_object('rateAt',(p->>'signalCloseAt')::timestamptz-interval '1 hour');
 s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
 perform pg_temp.assert_true((select eligibility='ineligible' from public.setups where id=s),'KES minimum lot exceeds budget');
 p:=pg_temp.setup_fixture('buy',now()-interval '114 days');p:=jsonb_set(p,'{h4Candles,59,at}',to_jsonb(now()::text));
 s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
 perform pg_temp.assert_true((select eligibility='ineligible' and rule_snapshot->'result'->>'dataValid'='false' from public.setups where id=s),'future H4 evidence never passes');
end$$;
-- A profitable result must not erase a sizing breach.
select public.record_journal_trade('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',jsonb_build_object('setupId',(select id from public.setups where direction='sell' limit 1),'mode','backtest','side','sell','accountRef','historical-main','openedAt',(select signal_close_at from public.setups where direction='sell' limit 1),'entry',1.1332,'stop',1.1349,'target',1.1298,'lots',1,'costUSD',0,'notes','Executed despite volume deviation.'));
select public.close_journal_trade('cccccccc-cccc-4ccc-8ccc-cccccccccccc',(select id from public.trades limit 1),0,now()-interval '118 days',1.1298,1,'Positive result does not repair the breach.');
select pg_temp.assert_true((select realised_pnl_usd=339 and rule_compliant=false from public.trades),'SELL sign/cost and breach preservation');
select public.close_journal_trade('cccccccc-cccc-4ccc-8ccc-cccccccccccc',(select id from public.trades limit 1),0,now()-interval '118 days',1.1298,1,'Positive result does not repair the breach.');
select pg_temp.assert_true((select revision=1 from public.trades),'closing retry idempotent');
select public.close_journal_trade(gen_random_uuid(),(select id from public.trades limit 1),1,now()-interval '118 days',1.1352,2,'Corrected losing exit.');
select pg_temp.assert_true((select realised_pnl_usd=-202 and planned_risk_usd=180 and rule_compliant=false from public.trades),'correction freezes risk and retains loss');
do $$begin
 begin perform public.close_journal_trade(gen_random_uuid(),(select id from public.trades limit 1),0,now(),1.1298,0,'Stale edit');raise exception 'FAILED: stale close allowed';exception when serialization_failure then null;end;
 begin update public.setups set eligibility='eligible';raise exception 'FAILED: client eligibility edit';exception when insufficient_privilege then null;end;
 begin update public.trades set realised_pnl_usd=99999;raise exception 'FAILED: client P/L spoof';exception when insufficient_privilege then null;end;
 begin update public.strategy_versions set params='{}';raise exception 'FAILED: client strategy edit';exception when insufficient_privilege then null;end;
end$$;
-- Missing initial stop remains an honest breach with unavailable R.
select public.record_journal_trade(gen_random_uuid(),jsonb_build_object('setupId',null,'mode','demo','side','buy','accountRef','demo-main','openedAt',now(),'entry',1.1,'stop',null,'target',null,'lots',.01,'costUSD',0,'notes','External trade with no initial stop.'));
select public.close_journal_trade(gen_random_uuid(),(select id from public.trades where mode='demo'),0,now(),1.099,0.1,'Loss recorded honestly.');
select pg_temp.assert_true((select realised_pnl_usd=-1.1 and realised_r is null and rule_compliant=false from public.trades where mode='demo'),'unknown initial risk is never invented');
do $$declare i integer;s uuid;p jsonb;begin
 begin perform public.freeze_backtest_development();raise exception 'FAILED: premature freeze';exception when invalid_parameter_value then null;end;
 for i in 1..70 loop
  p:=pg_temp.setup_fixture('buy',now()-make_interval(days=>101-i));
  perform public.evaluate_and_save_setup(gen_random_uuid(),p);
 end loop;
 perform public.freeze_backtest_development();
 for i in 1..30 loop
  p:=pg_temp.setup_fixture('buy',now()-make_interval(days=>31-i))||'{"dataset":"held_out"}';
  s:=public.evaluate_and_save_setup(gen_random_uuid(),p);
 end loop;
 perform pg_temp.assert_true((public.journal_evidence_counts()->>'development')::integer>=70,'development count');
 perform pg_temp.assert_true((public.journal_evidence_counts()->>'held_out')::integer=30,'held-out count');
 perform pg_temp.assert_true((public.journal_evidence_counts()->>'frozen')::boolean,'freeze persisted');
 perform pg_temp.assert_true((select (x->>'profit_factor')::numeric=0 from jsonb_array_elements(public.journal_summary()) x where x->>'mode'='demo'),'all-loss profit factor zero');
end$$;
do $$declare parent uuid;path text;begin
 select id into parent from public.setups limit 1;
 path:=auth.uid()::text||'/setup/'||parent::text||'/test.png';
 insert into storage.objects(bucket_id,name,metadata) values('tradepath-journal',path,'{"mimetype":"image/png","size":100}');
 begin perform public.attach_journal_screenshot(gen_random_uuid(),'setup',parent,path,'image/png',101);raise exception 'FAILED: incorrect metadata accepted';exception when invalid_parameter_value then null;end;
 perform public.attach_journal_screenshot(gen_random_uuid(),'setup',parent,path,'image/png',100);
 delete from storage.objects where name=path;
 perform pg_temp.assert_true(exists(select 1 from storage.objects where name=path),'attached screenshot cannot be deleted');
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true((select count(*)=0 from public.setups),'B cannot read A setups');
select pg_temp.assert_true((select count(*)=0 from public.screenshots),'B cannot read screenshot metadata');
select pg_temp.assert_true((select count(*)=0 from storage.objects),'B cannot read screenshot objects');
select pg_temp.assert_true((select count(*)=0 from public.trades),'B cannot read A trades');
select pg_temp.assert_true((select count(*)=0 from public.gate_evaluations),'B cannot read A gates');
reset role;
select pg_temp.assert_true((select public=false from storage.buckets where id='tradepath-journal'),'screenshot bucket private');
set role anon;
do $$begin
 begin perform public.evaluate_and_save_setup(gen_random_uuid(),'{}');raise exception 'FAILED: anonymous setup allowed';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.screenshots;raise exception 'FAILED: anonymous screenshots visible';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Simulate the Storage API's successful byte removal in the local SQL fixture.
select public.queue_account_deletion('11111111-1111-4111-8111-111111111111');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin
 begin perform public.check_in_practice((now() at time zone 'Africa/Nairobi')::date,'Calm');raise exception 'FAILED: writes after deletion queued';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) select 'tradepath-journal',auth.uid()::text||'/setup/'||id::text||'/late.png' from public.setups limit 1;raise exception 'FAILED: upload after deletion queued';exception when insufficient_privilege then null;end;
 begin perform public.queue_account_deletion('22222222-2222-4222-8222-222222222222');raise exception 'FAILED: client can queue another user';exception when insufficient_privilege then null;end;
end$$;
reset role;
delete from storage.objects where bucket_id='tradepath-journal' and split_part(name,'/',1)='11111111-1111-4111-8111-111111111111';
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
select pg_temp.assert_true((select count(*)=0 from public.setups),'purge cascades immutable setups');
select pg_temp.assert_true((select count(*)=0 from public.gate_evaluations),'purge cascades immutable gates');
select pg_temp.assert_true((select count(*)=0 from public.screenshots),'purge cascades screenshot metadata');
select pg_temp.assert_true((select count(*)=0 from public.trades),'purge cascades trades');
select pg_temp.assert_true((select count(*)=0 from public.audit_events),'purge cascades audit');
select pg_temp.assert_true(exists(select 1 from auth.users where id='22222222-2222-4222-8222-222222222222'),'other account retained');
select public.finish_account_deletion('11111111-1111-4111-8111-111111111111');
select pg_temp.assert_true((select count(*)=0 from public.account_deletions),'completed job removed');
rollback;
\echo 'Journal rule, accounting and isolation checks passed.'
