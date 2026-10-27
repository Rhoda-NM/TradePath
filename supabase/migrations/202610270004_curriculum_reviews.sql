begin;
create table public.lessons (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 phase_number smallint not null check(phase_number between 1 and 6),
 week_number smallint not null check(week_number between 1 and 4),
 title text not null, instructions text not null,
 evidence_kind text not null check(evidence_kind in ('chart','risk','plan','reflection')),
 required_count integer not null check(required_count>0),sort_order integer not null
);
create table public.learning_evidence (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 lesson_code text not null references public.lessons(code),observed_on date not null,
 notes text not null check(length(btrim(notes)) between 80 and 6000),details jsonb not null,
 backdated boolean not null,client_operation_id uuid not null,fingerprint text not null,
 created_at timestamptz not null default now(),
 unique(user_id,client_operation_id),unique(user_id,lesson_code,fingerprint)
);
create table public.lesson_progress (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null references public.lessons(id),state text not null check(state in ('in_progress','completed')),
 evidence_count integer not null check(evidence_count>=0),completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,lesson_id)
);
alter table public.lessons enable row level security;
alter table public.learning_evidence enable row level security;
alter table public.lesson_progress enable row level security;
revoke all on public.lessons,public.learning_evidence,public.lesson_progress from public,anon,authenticated;
grant select on public.lessons,public.learning_evidence,public.lesson_progress to authenticated;
create policy curriculum_read on public.lessons for select to authenticated using(true);
create policy owner_read on public.learning_evidence for select to authenticated using(user_id=(select auth.uid()));
create policy owner_read on public.lesson_progress for select to authenticated using(user_id=(select auth.uid()));
create index learning_user_date on public.learning_evidence(user_id,observed_on desc);
alter table public.weekly_reviews add column reflection text;
alter table public.weekly_reviews add column state text not null default 'draft' check(state in ('draft','submitted'));
alter table public.weekly_reviews add column revision bigint not null default 0;
alter table public.weekly_reviews add column last_operation_id uuid;
alter table public.weekly_reviews add column updated_at timestamptz not null default now();
insert into public.lessons(code,phase_number,week_number,title,instructions,evidence_kind,required_count,sort_order)
select code,phase_number,week_number,title,instructions,evidence_kind,required_count,sort_order
from jsonb_to_recordset($catalog$[{"code":"p1-w1","phase_number":1,"week_number":1,"title":"Your written practice plan","instructions":"Write a demo-only plan covering your available time, EUR/USD, the H4/H1 experimental rules, risk limits, and when you will deliberately sit out.","evidence_kind":"plan","required_count":1,"sort_order":1},{"code":"p1-w2","phase_number":1,"week_number":2,"title":"Pips, costs and position sizing","instructions":"Work through ten distinct hypothetical EUR/USD position sizes. Include spread, commission, lot increment and broker minimums. A size below the minimum means skip; never round up.","evidence_kind":"risk","required_count":10,"sort_order":2},{"code":"p1-w3","phase_number":1,"week_number":3,"title":"Confirmed H4 structure","instructions":"Annotate ten historical charts. Identify swing highs and lows with two closed candles on each side. Describe when confirmation became available; avoid look-ahead assumptions.","evidence_kind":"chart","required_count":10,"sort_order":3},{"code":"p1-w4","phase_number":1,"week_number":4,"title":"H4 zones and closed H1 candles","instructions":"Annotate ten more charts. Describe the pre-existing H4 zone, the closed H1 candle and a reason to accept further study or skip. These are learning annotations, not eligibility evaluations.","evidence_kind":"chart","required_count":10,"sort_order":4},{"code":"p2-w1","phase_number":2,"week_number":1,"title":"Sequential sampling","instructions":"Document how you will select consecutive historical candidates without cherry-picking wins. Separate development and untouched held-out data.","evidence_kind":"reflection","required_count":1,"sort_order":5},{"code":"p2-w2","phase_number":2,"week_number":2,"title":"Development log","instructions":"Reflect on the first 35 candidates and how spread, commission, timestamps and excluded news windows will be documented. Candidate validation belongs to the setup journal.","evidence_kind":"reflection","required_count":1,"sort_order":6},{"code":"p2-w3","phase_number":2,"week_number":3,"title":"Freeze before held-out testing","instructions":"Document the exact strategy version to freeze after 70 development samples. Explain why the 30 held-out candidates must remain untouched until then.","evidence_kind":"reflection","required_count":1,"sort_order":7},{"code":"p2-w4","phase_number":2,"week_number":4,"title":"Review all outcomes","instructions":"Describe what after-cost average R can and cannot tell you from a small sample. Preserve losing and rejected candidates. Validated dataset counts are required separately.","evidence_kind":"reflection","required_count":1,"sort_order":8},{"code":"p3-w1","phase_number":3,"week_number":1,"title":"A calm check-in","instructions":"Reflect on your emotional state and why fatigue or pressure defaults to study-only. There is no requirement to place a trade.","evidence_kind":"reflection","required_count":1,"sort_order":9},{"code":"p3-w2","phase_number":3,"week_number":2,"title":"Wait for closed evidence","instructions":"Explain what you must document before an H1 confirmation can be evaluated, including the pre-existing H4 zone and manual news check.","evidence_kind":"reflection","required_count":1,"sort_order":10},{"code":"p3-w3","phase_number":3,"week_number":3,"title":"Record the honest outcome","instructions":"Describe how you will keep valid no-trade decisions separate from executions and retain rule breaches even when an execution wins.","evidence_kind":"reflection","required_count":1,"sort_order":11},{"code":"p3-w4","phase_number":3,"week_number":4,"title":"Review the week","instructions":"Review what helped your process and one change for next week. Forward-trade milestones will use validated journal records, not this reflection.","evidence_kind":"reflection","required_count":1,"sort_order":12},{"code":"p4-w1","phase_number":4,"week_number":1,"title":"Compare like with like","instructions":"Explain how you will compare development, held-out and forward demo results without pooling them.","evidence_kind":"reflection","required_count":1,"sort_order":13},{"code":"p4-w2","phase_number":4,"week_number":2,"title":"Recurring mistakes","instructions":"Reflect on recurring process mistakes. Distinguish poor outcomes under the rules from profitable rule breaches.","evidence_kind":"reflection","required_count":1,"sort_order":14},{"code":"p4-w3","phase_number":4,"week_number":3,"title":"Drawdown needs equity records","instructions":"Describe why maximum drawdown needs chronological account equity records and cash-flow context. Missing equity history remains unavailable.","evidence_kind":"reflection","required_count":1,"sort_order":15},{"code":"p4-w4","phase_number":4,"week_number":4,"title":"Evidence before confidence","instructions":"Review sample size, losses, costs and adherence. Reflection alone does not establish readiness or profitability.","evidence_kind":"reflection","required_count":1,"sort_order":16},{"code":"p5-w1","phase_number":5,"week_number":1,"title":"Read the programme rules","instructions":"Document the provider rules you intend to verify: daily and total loss, equity treatment, reset timezone and the rule-set timestamp.","evidence_kind":"reflection","required_count":1,"sort_order":17},{"code":"p5-w2","phase_number":5,"week_number":2,"title":"Keep simulations free","instructions":"Explain how you will document a free evaluation. If a chosen provider has no free trial, postpone rather than substituting a paid evaluation.","evidence_kind":"reflection","required_count":1,"sort_order":18},{"code":"p5-w3","phase_number":5,"week_number":3,"title":"Reset-time practice","instructions":"Describe how an external trial calculates its daily reset and open exposure. Automated simulation support is a later release.","evidence_kind":"reflection","required_count":1,"sort_order":19},{"code":"p5-w4","phase_number":5,"week_number":4,"title":"Review trial evidence","instructions":"Reflect on externally documented results and any rule breaches. Two verified free evaluations require their own evidence; notes do not pass that gate.","evidence_kind":"reflection","required_count":1,"sort_order":20},{"code":"p6-w1","phase_number":6,"week_number":1,"title":"Audit the full record","instructions":"Review historical and forward evidence, including losing periods, missing records and divergence between samples.","evidence_kind":"reflection","required_count":1,"sort_order":21},{"code":"p6-w2","phase_number":6,"week_number":2,"title":"Affordability and eligibility","instructions":"Document what fee affordability, identity eligibility and current payout terms would require you to verify independently.","evidence_kind":"reflection","required_count":1,"sort_order":22},{"code":"p6-w3","phase_number":6,"week_number":3,"title":"An unpressured decision","instructions":"Write your reasons for postponing, declining or independently reviewing a possible evaluation. No purchase is required.","evidence_kind":"reflection","required_count":1,"sort_order":23},{"code":"p6-w4","phase_number":6,"week_number":4,"title":"Keep the learning routine","instructions":"Write a sustainable process for the next month, regardless of the evaluation decision. This curriculum never enables real-money orders.","evidence_kind":"reflection","required_count":1,"sort_order":24}]$catalog$::jsonb) as l(code text,phase_number smallint,week_number smallint,title text,instructions text,evidence_kind text,required_count integer,sort_order integer);

create function tradepath_private.refresh_learning(p_user uuid) returns void
language plpgsql set search_path='' as $$
declare v_phase public.curriculum_phases; v_current boolean:=false; v_complete boolean; v_today date; v_next text;
begin
 select (now() at time zone timezone)::date into v_today from public.profiles where user_id=p_user;
 if v_today is null then raise exception 'Complete onboarding first'; end if;
 insert into public.lesson_progress(user_id,lesson_id,state,evidence_count,completed_at)
 select p_user,l.id,case when count(e.id)>=l.required_count then 'completed' else 'in_progress' end,count(e.id)::integer,
 case when count(e.id)>=l.required_count then max(e.created_at) else null end
 from public.lessons l left join public.learning_evidence e on e.lesson_code=l.code and e.user_id=p_user
 group by l.id having count(e.id)>0
 on conflict(user_id,lesson_id) do update set state=excluded.state,evidence_count=excluded.evidence_count,completed_at=excluded.completed_at,updated_at=now();
 for v_phase in select * from public.curriculum_phases where user_id=p_user order by phase_number for update loop
  -- Phase 1 can be derived from learning evidence. Later trade/evaluation gates
  -- intentionally remain closed until validated journal evidence is integrated.
  select v_phase.phase_number=1 and not exists(
   select 1 from public.lessons l where l.phase_number=1 and
    (select count(*) from public.learning_evidence e where e.user_id=p_user and e.lesson_code=l.code)<l.required_count
  ) into v_complete;
  if v_complete then v_next:='completed';
  elsif not v_current then v_current:=true;v_next:=case when v_phase.planned_end<v_today then 'needs_practice' else 'active' end;
  else v_next:='not_started';end if;
  update public.curriculum_phases set state=v_next,verified_at=case when v_next='completed' then coalesce(verified_at,now()) else null end where id=v_phase.id;
 end loop;
end $$;
revoke all on function tradepath_private.refresh_learning(uuid) from public,anon,authenticated;

create function public.refresh_learning_plan() returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,1));
 perform tradepath_private.refresh_learning(v_user);
end $$;

create function tradepath_private.risk_exercise(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare v_key text; v_balance numeric;v_rate numeric;v_entry numeric;v_stop numeric;v_risk numeric;v_pips numeric;v_commission numeric;v_min numeric;v_step numeric;v_budget numeric;v_distance numeric;v_lots numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid risk exercise' using errcode='22023';end if;
 foreach v_key in array array['balance','rate','entry','stop','riskPercent','pipCost','commission','minLot','lotStep'] loop
  if jsonb_typeof(p->v_key) is distinct from 'number' then raise exception 'Incomplete risk exercise' using errcode='22023';end if;
 end loop;
 v_balance:=trim_scale((p->>'balance')::numeric);v_rate:=trim_scale((p->>'rate')::numeric);v_entry:=trim_scale((p->>'entry')::numeric);v_stop:=trim_scale((p->>'stop')::numeric);v_risk:=trim_scale((p->>'riskPercent')::numeric);v_pips:=trim_scale((p->>'pipCost')::numeric);v_commission:=trim_scale((p->>'commission')::numeric);v_min:=trim_scale((p->>'minLot')::numeric);v_step:=trim_scale((p->>'lotStep')::numeric);
 if p->>'currency' is null or p->>'currency' not in ('KES','USD') or p->>'side' is null or p->>'side' not in ('buy','sell') or v_balance<=0 or v_rate<=0 or v_entry<=0 or v_stop<=0 or v_risk<=0 or v_risk>0.5 or v_pips<0 or v_commission<0 or v_min<=0 or v_step<=0 or (p->>'side'='buy' and v_stop>=v_entry) or (p->>'side'='sell' and v_stop<=v_entry) then raise exception 'Invalid risk exercise inputs' using errcode='22023';end if;
 v_budget:=(case when p->>'currency'='KES' then v_balance/v_rate else v_balance end)*v_risk/100;
 v_distance:=abs(v_entry-v_stop)*10000;
 v_lots:=floor((v_budget/((v_distance+v_pips)*10+v_commission))/v_step)*v_step;
 -- Store a canonical input snapshot plus server-derived results; ignore supplied outputs.
 return jsonb_build_object('balance',v_balance,'currency',p->>'currency','rate',v_rate,'side',p->>'side','entry',v_entry,'stop',v_stop,'riskPercent',v_risk,'pipCost',v_pips,'commission',v_commission,'minLot',v_min,'lotStep',v_step,'riskUSD',v_budget,'distancePips',v_distance,'suggestedLots',v_lots,'skip',v_lots<v_min);
end $$;
revoke all on function tradepath_private.risk_exercise(jsonb) from public,anon,authenticated;

create function public.record_learning_evidence(p_operation uuid,p_lesson text,p_observed date,p_notes text,p_details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_lesson public.lessons;v_timezone text;v_start date;v_today date;v_details jsonb;v_hash text;v_id uuid;v_existing public.learning_evidence;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,1));
 select timezone,start_date into v_timezone,v_start from public.profiles where user_id=v_user;
 if v_timezone is null then raise exception 'Complete onboarding first';end if;
 v_today:=(now() at time zone v_timezone)::date;
 select * into v_lesson from public.lessons where code=p_lesson;
 if not found or p_operation is null or p_observed is null or p_observed<v_start or p_observed>v_today or p_notes is null or length(btrim(p_notes)) not between 80 and 6000 or jsonb_typeof(p_details) is distinct from 'object' or pg_column_size(p_details)>10000 then raise exception 'Invalid learning evidence' using errcode='22023';end if;
 if v_lesson.evidence_kind='risk' then v_details:=tradepath_private.risk_exercise(p_details);
 elsif v_lesson.evidence_kind='chart' then
  if p_details->>'symbol' is distinct from 'EURUSD' or p_details->>'timeframe' is null or p_details->>'timeframe' not in ('H4','H1') or p_details->>'chartTime' is null or not isfinite((p_details->>'chartTime')::timestamptz) or (p_details->>'chartTime')::timestamptz>now() then raise exception 'Invalid chart annotation' using errcode='22023';end if;
  v_details:=jsonb_build_object('symbol','EURUSD','timeframe',p_details->>'timeframe','chartTime',(p_details->>'chartTime')::timestamptz);
 else
  if p_details<>'{}'::jsonb then raise exception 'Unexpected evidence details' using errcode='22023';end if;
  v_details:='{}'::jsonb;
 end if;
 v_hash:=md5(case when v_lesson.evidence_kind in ('risk','chart') then v_details::text else jsonb_build_object('date',p_observed,'notes',btrim(p_notes),'details',v_details)::text end);
 select * into v_existing from public.learning_evidence where user_id=v_user and client_operation_id=p_operation;
 if found then
  if v_existing.lesson_code<>p_lesson or v_existing.fingerprint<>v_hash or v_existing.observed_on<>p_observed or v_existing.notes<>btrim(p_notes) then raise exception 'Operation ID reused with different inputs' using errcode='22023';end if;
  return;
 end if;
 if v_lesson.evidence_kind='chart' and exists(select 1 from public.learning_evidence e join public.lessons l on l.code=e.lesson_code where e.user_id=v_user and l.evidence_kind='chart' and e.details=v_details) then raise exception 'This chart annotation is already counted' using errcode='23505';end if;
 if exists(select 1 from public.learning_evidence where user_id=v_user and lesson_code=p_lesson and fingerprint=v_hash) then raise exception 'This evidence is already recorded' using errcode='23505';end if;
 insert into public.learning_evidence(user_id,lesson_code,observed_on,notes,details,backdated,client_operation_id,fingerprint)
 values(v_user,p_lesson,p_observed,btrim(p_notes),v_details,p_observed<v_today,p_operation,v_hash) returning id into v_id;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(v_user,'learning_evidence',v_id,'created',jsonb_build_object('lesson',p_lesson,'backdated',p_observed<v_today));
 perform tradepath_private.refresh_learning(v_user);
end $$;

create function public.weekly_review_facts(p_week date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_today date:=(now() at time zone 'Africa/Nairobi')::date;v_start date;v_from timestamptz;v_to timestamptz;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501';end if;
 select start_date into v_start from public.profiles where user_id=v_user;
 if v_start is null then raise exception 'Complete onboarding first';end if;
 if p_week is null or extract(isodow from p_week)<>1 or p_week>v_today or p_week<date_trunc('week',v_start::timestamp)::date then raise exception 'Invalid review week' using errcode='22023';end if;
 v_from:=p_week::timestamp at time zone 'Africa/Nairobi';v_to:=(p_week+7)::timestamp at time zone 'Africa/Nairobi';
 return jsonb_build_object(
  'weekday_sessions_due',(select count(*) from generate_series(greatest(p_week,v_start)::timestamp,least(p_week+6,v_today)::timestamp,interval '1 day') d where extract(isodow from d)<=5),
  'recorded_sessions',(select count(*) from public.daily_sessions where user_id=v_user and created_at>=v_from and created_at<v_to and session_status in ('active','study_only','complete')),
  'setups_inspected',(select count(*) from public.setups where user_id=v_user and created_at>=v_from and created_at<v_to),
  'no_trade_decisions',(select count(*) from public.no_trade_decisions where user_id=v_user and created_at>=v_from and created_at<v_to),
  'rule_breaches',(select count(*) from public.trades where user_id=v_user and mode='demo' and opened_at>=v_from and opened_at<v_to and rule_compliant=false),
  'closed_demo_trades',(select count(*) from public.trades where user_id=v_user and mode='demo' and closed_at>=v_from and closed_at<v_to),
  'realised_r',(select sum(realised_r) from public.trades where user_id=v_user and mode='demo' and closed_at>=v_from and closed_at<v_to),
  'learning_records',(select count(*) from public.learning_evidence where user_id=v_user and created_at>=v_from and created_at<v_to)
 );
end $$;

create function public.save_weekly_review(p_week date,p_reflection text,p_commitment text,p_submit boolean,p_revision bigint,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_existing public.weekly_reviews;v_facts jsonb;v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_operation is null or p_revision is null or p_revision<0 or p_submit is null or p_reflection is null or p_commitment is null or length(p_reflection)>6000 or length(p_commitment)>1000 or (p_submit and (length(btrim(p_reflection))<80 or length(btrim(p_commitment))<10)) then raise exception 'Invalid review' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,2));
 v_facts:=public.weekly_review_facts(p_week);
 select * into v_existing from public.weekly_reviews where user_id=v_user and week_start_local_date=p_week for update;
 if found then
  if v_existing.last_operation_id=p_operation then
   if v_existing.reflection<>btrim(p_reflection) or v_existing.commitment<>btrim(p_commitment) or (v_existing.state='submitted')<>p_submit then raise exception 'Operation ID reused with different inputs' using errcode='22023';end if;
   return;
  end if;
  if v_existing.revision<>p_revision then raise exception 'Review changed elsewhere. Reload before saving.' using errcode='40001';end if;
  if v_existing.state='submitted' and not p_submit then raise exception 'Submitted reviews must remain submitted' using errcode='22023';end if;
  update public.weekly_reviews set reflection=btrim(p_reflection),commitment=btrim(p_commitment),facts=v_facts,state=case when p_submit then 'submitted' else 'draft' end,reviewed_at=case when p_submit then now() else null end,revision=revision+1,last_operation_id=p_operation,updated_at=now() where id=v_existing.id returning id into v_id;
 else
  if p_revision<>0 then raise exception 'Review changed elsewhere' using errcode='40001';end if;
  insert into public.weekly_reviews(user_id,week_start_local_date,reflection,commitment,facts,state,reviewed_at,revision,last_operation_id)
  values(v_user,p_week,btrim(p_reflection),btrim(p_commitment),v_facts,case when p_submit then 'submitted' else 'draft' end,case when p_submit then now() else null end,1,p_operation) returning id into v_id;
 end if;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(v_user,'weekly_review',v_id,case when p_submit then 'submitted' else 'draft_saved' end,jsonb_build_object('week',p_week));
end $$;
revoke all on function public.refresh_learning_plan(),public.record_learning_evidence(uuid,text,date,text,jsonb),public.weekly_review_facts(date),public.save_weekly_review(date,text,text,boolean,bigint,uuid) from public,anon,authenticated;
grant execute on function public.refresh_learning_plan(),public.record_learning_evidence(uuid,text,date,text,jsonb),public.weekly_review_facts(date),public.save_weekly_review(date,text,text,boolean,bigint,uuid) to authenticated;
create function public.set_practice_task_outcome(p_date date,p_task text,p_state text,p_reason text,p_revision bigint,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_session uuid;v_task public.daily_tasks;
begin
 v_session:=tradepath_private.ensure_day(p_date);
 if p_state is null or p_state not in ('pending','done','skipped','missed') or p_reason is null or length(p_reason)>500 or (p_state='skipped' and length(btrim(p_reason))<10) or (p_state<>'skipped' and p_reason<>'') or p_revision is null or p_revision<0 or p_operation is null then raise exception 'Invalid task outcome' using errcode='22023';end if;
 select * into v_task from public.daily_tasks where user_id=v_user and session_id=v_session and task_code=p_task for update;
 if not found then raise exception 'Unknown task' using errcode='22023';end if;
 if v_task.last_operation_id=p_operation then
  if v_task.state<>p_state or coalesce(v_task.skip_reason,'')<>btrim(p_reason) then raise exception 'Operation ID reused with different inputs' using errcode='22023';end if;
  return;
 end if;
 if v_task.revision<>p_revision then raise exception 'Task changed elsewhere. Reload before saving.' using errcode='40001';end if;
 update public.daily_tasks set state=p_state,skip_reason=nullif(btrim(p_reason),''),revision=revision+1,last_operation_id=p_operation,completed_at=case when p_state in ('done','skipped') then now() else null end where id=v_task.id and user_id=v_user;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(v_user,'daily_task',v_task.id,'outcome_changed',jsonb_build_object('state',p_state));
end $$;
create or replace function public.set_practice_task(p_date date,p_task text,p_done boolean,p_revision bigint,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_done is null then raise exception 'Invalid task state' using errcode='22023';end if;
 perform public.set_practice_task_outcome(p_date,p_task,case when p_done then 'done' else 'pending' end,'',p_revision,p_operation);
end $$;
revoke all on function public.set_practice_task_outcome(date,text,text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.set_practice_task_outcome(date,text,text,text,bigint,uuid) to authenticated;

commit;
