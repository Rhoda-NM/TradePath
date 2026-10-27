begin;
alter table public.profiles add column start_date date not null default date '2026-10-26';
alter table public.no_trade_decisions add column client_operation_id uuid;
create unique index no_trade_operation_unique on public.no_trade_decisions(user_id,client_operation_id);
alter table public.daily_tasks add column revision bigint not null default 0;
alter table public.daily_tasks add column last_operation_id uuid;
create schema if not exists tradepath_private;
revoke all on schema tradepath_private from public, anon, authenticated;

-- This private helper runs only inside the authorized definer RPCs below.
create function tradepath_private.ensure_day(p_date date) returns uuid
language plpgsql set search_path='' as $$
declare v_user uuid := auth.uid(); v_timezone text; v_id uuid; v_tasks text[]; v_task text;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select timezone into v_timezone from public.profiles where user_id=v_user;
 if v_timezone is null then raise exception 'Complete onboarding first'; end if;
 if p_date is null or p_date<>(current_timestamp at time zone v_timezone)::date then raise exception 'Local date changed. Reload before saving.' using errcode='22023'; end if;
 insert into public.daily_sessions(user_id,local_date) values(v_user,p_date) on conflict(user_id,local_date) do nothing;
 select id into v_id from public.daily_sessions where user_id=v_user and local_date=p_date;
 v_tasks := case when extract(isodow from p_date) in (6,7) then array['Annotate historical charts','Practise position sizing','Review your journal','Write your weekly reflection'] else array['Check the economic calendar','Mark H4 structure and bias','Define your H4 zone','Assess the closed H1 candle','Journal and reflect'] end;
 foreach v_task in array v_tasks loop
  insert into public.daily_tasks(user_id,session_id,task_code) values(v_user,v_id,v_task) on conflict(session_id,task_code) do nothing;
 end loop;
 return v_id;
end $$;
revoke all on function tradepath_private.ensure_day(date) from public,anon,authenticated;

-- Definer rights are necessary because table mutation grants remain revoked.
-- Every public entry point derives its owner from auth.uid(), never from input.
create function public.complete_onboarding(p_start date,p_timezone text,p_minutes integer,p_capital numeric default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_start date; i integer;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_start is null or p_start<date '2020-01-01' or p_start>date '2100-01-01' or p_timezone is null or p_timezone not in ('Africa/Nairobi','UTC','Europe/London','America/New_York') or p_minutes is null or p_minutes not in (60,90,120) or (p_capital is not null and (p_capital<0 or p_capital>100000000 or p_capital::text in ('NaN','Infinity','-Infinity'))) then raise exception 'Invalid onboarding preferences' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
 select start_date into v_start from public.profiles where user_id=v_user;
 if v_start is not null and v_start<>p_start then raise exception 'The original curriculum start date is preserved.' using errcode='22023'; end if;
 insert into public.profiles(user_id,start_date,timezone,available_minutes,capital_kes) values(v_user,p_start,p_timezone,p_minutes,p_capital)
 on conflict(user_id) do update set timezone=excluded.timezone, available_minutes=excluded.available_minutes,capital_kes=excluded.capital_kes,updated_at=now();
 insert into public.strategy_versions(user_id,code,version,params) values(v_user,'H4H1',1,'{"risk_percent":0.5,"max_daily_entries":2,"experimental":true}'::jsonb) on conflict(user_id,code,version) do nothing;
 for i in 0..5 loop
  insert into public.curriculum_phases(user_id,phase_number,planned_start,planned_end,state)
  values(v_user,i+1,(p_start+make_interval(months=>i))::date,(p_start+make_interval(months=>i+1))::date-1,case when i=0 then 'active' else 'not_started' end)
  on conflict(user_id,phase_number) do nothing;
 end loop;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(v_user,'profile',v_user,'onboarding',jsonb_build_object('timezone',p_timezone,'minutes',p_minutes));
end $$;

create function public.ensure_practice_day(p_date date) returns void
language plpgsql security definer set search_path='' as $$ begin perform tradepath_private.ensure_day(p_date); end $$;

create function public.set_practice_task(p_date date,p_task text,p_done boolean,p_revision bigint,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_session uuid; v_task public.daily_tasks; v_next text;
begin
 v_session:=tradepath_private.ensure_day(p_date);
 if p_done is null or p_revision is null or p_revision<0 or p_operation is null then raise exception 'Invalid task state' using errcode='22023'; end if;
 select * into v_task from public.daily_tasks where user_id=v_user and session_id=v_session and task_code=p_task for update;
 if not found then raise exception 'Unknown task' using errcode='22023'; end if;
 v_next:=case when p_done then 'done' else 'pending' end;
 if v_task.last_operation_id=p_operation then
  if v_task.state<>v_next then raise exception 'Operation ID reused with different inputs' using errcode='22023'; end if;
  return;
 end if;
 if v_task.revision<>p_revision then raise exception 'Task changed elsewhere. Reload and retry.' using errcode='40001'; end if;
 update public.daily_tasks set state=v_next,revision=revision+1,last_operation_id=p_operation,completed_at=case when p_done then now() else null end where id=v_task.id and user_id=v_user;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(v_user,'daily_task',v_task.id,'state_changed',jsonb_build_object('state',v_next));
end $$;

create function public.check_in_practice(p_date date,p_emotion text) returns void
language plpgsql security definer set search_path='' as $$
declare v_session uuid; v_status text;
begin
 v_session:=tradepath_private.ensure_day(p_date);
 if p_emotion is null or p_emotion not in ('Calm','Distracted','Fatigued','Pressure to recover') then raise exception 'Invalid check-in' using errcode='22023'; end if;
 v_status:=case when p_emotion='Calm' then 'active' else 'study_only' end;
 update public.daily_sessions set emotion=p_emotion,session_status=v_status,updated_at=now() where id=v_session and user_id=auth.uid();
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(auth.uid(),'daily_session',v_session,'check_in',jsonb_build_object('status',v_status));
end $$;

create function public.record_no_trade(p_date date,p_operation uuid,p_reason text,p_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_session uuid; v_id uuid; v_existing public.no_trade_decisions;
begin
 v_session:=tradepath_private.ensure_day(p_date);
 if p_operation is null or p_reason is null or p_reason not in ('No qualifying setup','High-impact news window','Risk exceeds broker minimum','Daily risk limit reached','Study-only session') or p_notes is null or length(p_notes)>2000 then raise exception 'Invalid no-trade decision' using errcode='22023'; end if;
 insert into public.no_trade_decisions(user_id,session_id,reason,notes,client_operation_id) values(v_user,v_session,p_reason,btrim(p_notes),p_operation) on conflict(user_id,client_operation_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_existing from public.no_trade_decisions where user_id=v_user and client_operation_id=p_operation;
  if v_existing.session_id<>v_session or v_existing.reason<>p_reason or v_existing.notes<>btrim(p_notes) then raise exception 'Operation ID reused with different inputs' using errcode='22023'; end if;
  return;
 end if;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(v_user,'no_trade_decision',v_id,'created',jsonb_build_object('reason',p_reason));
end $$;

revoke all on function public.complete_onboarding(date,text,integer,numeric),public.ensure_practice_day(date),public.set_practice_task(date,text,boolean,bigint,uuid),public.check_in_practice(date,text),public.record_no_trade(date,uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_onboarding(date,text,integer,numeric),public.ensure_practice_day(date),public.set_practice_task(date,text,boolean,bigint,uuid),public.check_in_practice(date,text),public.record_no_trade(date,uuid,text,text) to authenticated;
commit;
