\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',message;end if;end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.complete_onboarding((now() at time zone 'Africa/Nairobi')::date-90,'Africa/Nairobi',90,null);
select public.refresh_learning_plan();
select pg_temp.assert_true((select count(*)=24 from public.lessons),'24 weekly lessons seeded');
select pg_temp.assert_true((select state='needs_practice' from public.curriculum_phases where phase_number=1),'expired dates do not pass phases');
select public.record_learning_evidence('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','p1-w1',(now() at time zone 'Africa/Nairobi')::date-1,repeat('My written practice plan includes study time, demo-only risk rules and valid reasons to skip. ',2),'{}');
select public.record_learning_evidence('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','p1-w1',(now() at time zone 'Africa/Nairobi')::date-1,repeat('My written practice plan includes study time, demo-only risk rules and valid reasons to skip. ',2),'{}');
select pg_temp.assert_true((select count(*)=1 from public.learning_evidence),'evidence retry idempotent');
select pg_temp.assert_true((select backdated from public.learning_evidence),'backdated evidence labelled by server');
select pg_temp.assert_true((select state='completed' from public.lesson_progress),'progress derives from evidence');
do $$declare i integer;v_risk jsonb;begin
 for i in 1..10 loop
  v_risk:=jsonb_build_object('balance',10000+i,'currency','KES','rate',129.89,'side','buy','entry',1.08,'stop',1.078,'riskPercent',0.5,'pipCost',1,'commission',0,'minLot',0.01,'lotStep',0.01,'suggestedLots',99);
  perform public.record_learning_evidence(gen_random_uuid(),'p1-w2',(now() at time zone 'Africa/Nairobi')::date,repeat('I calculated this hypothetical risk budget and found that broker minimum size would exceed it. ',2),v_risk);
  perform public.record_learning_evidence(gen_random_uuid(),'p1-w3',(now() at time zone 'Africa/Nairobi')::date,repeat('I annotated the confirmed swing with two closed bars on each side and recorded the confirmation time. ',2),jsonb_build_object('symbol','EURUSD','timeframe','H4','chartTime',now()-make_interval(days=>i)));
  perform public.record_learning_evidence(gen_random_uuid(),'p1-w4',(now() at time zone 'Africa/Nairobi')::date,repeat('I annotated the pre-existing zone and closed H1 rejection candle, including reasons to sit out. ',2),jsonb_build_object('symbol','EURUSD','timeframe','H1','chartTime',now()-make_interval(days=>i+20)));
 end loop;
end$$;
select pg_temp.assert_true((select count(*)=31 from public.learning_evidence),'31 individual foundation records');
select pg_temp.assert_true((select bool_and((details->>'suggestedLots')::numeric=0 and (details->>'skip')::boolean) from public.learning_evidence where lesson_code='p1-w2'),'risk outputs recomputed, never client supplied');
select pg_temp.assert_true((select state='completed' from public.curriculum_phases where phase_number=1),'foundation requires all evidence');
select pg_temp.assert_true((select state='needs_practice' from public.curriculum_phases where phase_number=2),'next phase extends until journal evidence exists');
do $$declare v_risk jsonb;v_chart jsonb;begin
 select details into v_risk from public.learning_evidence where lesson_code='p1-w2' limit 1;
 select details into v_chart from public.learning_evidence where lesson_code='p1-w3' limit 1;
 begin perform public.record_learning_evidence(gen_random_uuid(),'p1-w4',(now() at time zone 'Africa/Nairobi')::date,repeat('A previously counted chart should not count again in a different lesson. ',3),v_chart);raise exception 'FAILED: chart counted twice across lessons';exception when unique_violation then null;end;
 begin perform public.record_learning_evidence(gen_random_uuid(),'p1-w2',(now() at time zone 'Africa/Nairobi')::date,repeat('Different wording must not count the very same risk exercise twice. ',3),v_risk);raise exception 'FAILED: duplicate risk exercise counted';exception when unique_violation then null;end;
 begin perform public.record_learning_evidence(gen_random_uuid(),'p1-w1',(now() at time zone 'Africa/Nairobi')::date+1,repeat('Future evidence is not allowed. ',4),'{}');raise exception 'FAILED: future evidence accepted';exception when invalid_parameter_value then null;end;
 begin perform public.record_learning_evidence('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','p1-w1',(now() at time zone 'Africa/Nairobi')::date,repeat('A different payload reused the same identifier. ',4),'{}');raise exception 'FAILED: mismatched operation accepted';exception when invalid_parameter_value then null;end;
 begin update public.lesson_progress set state='completed';raise exception 'FAILED: manual milestone override';exception when insufficient_privilege then null;end;
 begin delete from public.learning_evidence;raise exception 'FAILED: evidence deletion allowed';exception when insufficient_privilege then null;end;
 begin update public.lessons set required_count=1;raise exception 'FAILED: client lesson override';exception when insufficient_privilege then null;end;
end$$;
do $$declare l text;begin
 foreach l in array array['p2-w1','p2-w2','p2-w3','p2-w4'] loop
  perform public.record_learning_evidence(gen_random_uuid(),l,(now() at time zone 'Africa/Nairobi')::date,repeat('These are reflection notes only and cannot replace validated historical sample and frozen-rule evidence. ',2),'{}');
 end loop;
end$$;
select pg_temp.assert_true((select state='needs_practice' from public.curriculum_phases where phase_number=2),'reflections cannot bypass historical sample gates');
select public.ensure_practice_day((now() at time zone 'Africa/Nairobi')::date);
select public.set_practice_task_outcome((now() at time zone 'Africa/Nairobi')::date,(select task_code from public.daily_tasks limit 1),'skipped','Study-only today due to fatigue',0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select pg_temp.assert_true((select count(*)=1 from public.daily_tasks where state='skipped' and length(skip_reason)>10),'valid skips preserved separately from done');
do $$begin
 begin perform public.set_practice_task_outcome((now() at time zone 'Africa/Nairobi')::date,(select task_code from public.daily_tasks where state='pending' limit 1),'skipped','',0,gen_random_uuid());raise exception 'FAILED: unjustified skip accepted';exception when invalid_parameter_value then null;end;
end$$;
select public.save_weekly_review(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date,'Draft notes','',false,0,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select pg_temp.assert_true((select state='draft' and reviewed_at is null from public.weekly_reviews),'draft is not a submitted review');
select public.save_weekly_review(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date,repeat('I reviewed my learning records and the decisions to sit out without treating missed days as failed trades. ',2),'Annotate one historical chart before starting the next session.',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select public.save_weekly_review(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date,repeat('I reviewed my learning records and the decisions to sit out without treating missed days as failed trades. ',2),'Annotate one historical chart before starting the next session.',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select pg_temp.assert_true((select revision=2 and state='submitted' from public.weekly_reviews),'review retry does not duplicate or revise again');
select pg_temp.assert_true((select facts->'realised_r'='null'::jsonb and (facts->>'closed_demo_trades')::int=0 and (facts->>'learning_records')::int=35 from public.weekly_reviews),'server facts show insufficient performance evidence');
do $$begin
 begin perform public.save_weekly_review(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date,repeat('A stale submitted review must not overwrite newer reflection. ',3),'Keep an actionable commitment.',true,0,gen_random_uuid());raise exception 'FAILED: stale review accepted';exception when serialization_failure then null;end;
 begin perform public.weekly_review_facts(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date+1);raise exception 'FAILED: non-Monday review accepted';exception when invalid_parameter_value then null;end;
 begin update public.weekly_reviews set facts='{"realised_r":999}';raise exception 'FAILED: facts spoofing allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
insert into public.trades(user_id,mode,side,opened_at,closed_at,entry,stop,exit,volume_lots,cost_usd,planned_risk_usd,realised_pnl_usd,realised_r,rule_compliant) values
('11111111-1111-4111-8111-111111111111','demo','buy',now(),now(),1.1,1.09,1.11,0.001,0,2,1,0.5,false),
('11111111-1111-4111-8111-111111111111','backtest','buy',now(),now(),1.1,1.09,1.11,0.001,0,2,198,99,true),
('11111111-1111-4111-8111-111111111111','demo','sell',now(),null,1.1,1.11,null,0.001,0,2,null,null,false);
set role authenticated;
select pg_temp.assert_true((public.weekly_review_facts(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date)->>'realised_r')::numeric=0.5,'weekly facts exclude backtest and open trade R');
select pg_temp.assert_true((public.weekly_review_facts(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date)->>'rule_breaches')::int=2,'weekly breach facts retain open and closed demo breaches');
select pg_temp.assert_true((select facts->'realised_r'='null'::jsonb from public.weekly_reviews),'saved review facts do not silently change');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true((select count(*)=0 from public.learning_evidence),'B cannot read A evidence');
select pg_temp.assert_true((select count(*)=0 from public.lesson_progress),'B cannot read A progress');
select pg_temp.assert_true((select count(*)=0 from public.weekly_reviews),'B cannot read A reviews');
select public.complete_onboarding((now() at time zone 'Africa/Nairobi')::date-90,'Africa/Nairobi',90,null);
select public.refresh_learning_plan();
select pg_temp.assert_true((select state='needs_practice' from public.curriculum_phases where phase_number=1),'B cannot inherit A phase progress');
select pg_temp.assert_true((public.weekly_review_facts(date_trunc('week',(now() at time zone 'Africa/Nairobi'))::date)->>'learning_records')::int=0,'B facts exclude A evidence');
reset role;
set role anon;
do $$begin
 begin perform public.refresh_learning_plan();raise exception 'FAILED: anonymous refresh allowed';exception when insufficient_privilege then null;end;
 begin perform public.weekly_review_facts(current_date);raise exception 'FAILED: anonymous review access';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.learning_evidence;raise exception 'FAILED: anonymous evidence access';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
\echo 'Curriculum and review database checks passed.'
