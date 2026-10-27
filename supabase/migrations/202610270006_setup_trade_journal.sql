begin;
alter table public.audit_events add column event_order bigint generated always as identity;
alter table public.setups add column candidate_id uuid not null default gen_random_uuid();
alter table public.setups add column revision integer not null default 0;
alter table public.setups add column supersedes_id uuid;
alter table public.setups add column account_ref text not null default 'demo-main';
alter table public.setups add column dataset_split text check(dataset_split in ('development','held_out'));
alter table public.setups add column sequence_no integer;
alter table public.setups add column client_operation_id uuid;
alter table public.setups add foreign key(supersedes_id,user_id) references public.setups(id,user_id);
create unique index setup_candidate_revision on public.setups(user_id,candidate_id,revision);
create unique index setup_operation on public.setups(user_id,client_operation_id);
alter table public.trades alter column planned_risk_usd drop not null;
alter table public.trades alter column stop drop not null;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.trades'::regclass and contype='c' and pg_get_constraintdef(oid) like '%realised_r%' loop
  execute format('alter table public.trades drop constraint %I',c.conname);
 end loop;
end$$;
alter table public.trades add constraint trade_result_integrity check(
 (closed_at is null and exit is null and realised_pnl_usd is null and realised_r is null) or
 (closed_at is not null and exit is not null and realised_pnl_usd is not null and ((planned_risk_usd is null and realised_r is null) or (planned_risk_usd is not null and realised_r is not null)))
);
alter table public.trades add column account_ref text not null default 'demo-main';
alter table public.trades add column breach_reasons jsonb not null default '[]';
alter table public.trades add column revision integer not null default 0;
alter table public.trades add column client_operation_id uuid;
create unique index trade_operation on public.trades(user_id,client_operation_id);
create table public.backtest_freezes(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id) on delete cascade,strategy_version_id uuid not null,cutoff_signal timestamptz not null,created_at timestamptz not null default now(),foreign key(strategy_version_id,user_id) references public.strategy_versions(id,user_id));
create table public.journal_operations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,fingerprint text not null,result_id uuid not null,created_at timestamptz not null default now(),unique(user_id,operation_id));
alter table public.backtest_freezes enable row level security;
alter table public.journal_operations enable row level security;
revoke all on public.backtest_freezes,public.journal_operations from public,anon,authenticated;
grant select on public.backtest_freezes to authenticated;
create policy owner_read on public.backtest_freezes for select to authenticated using(user_id=(select auth.uid()));

create function tradepath_private.guard_history() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Historical evidence is immutable; create a new revision.' using errcode='42501';end$$;
revoke all on function tradepath_private.guard_history() from public,anon,authenticated;
create trigger setups_immutable before update or delete on public.setups for each row execute function tradepath_private.guard_history();
create trigger gates_immutable before update or delete on public.gate_evaluations for each row execute function tradepath_private.guard_history();
-- Audit events are append-only to application roles. Account purge will use a
-- dedicated administrator workflow; no application deletion grant is exposed.
create function tradepath_private.guard_strategy() returns trigger language plpgsql set search_path='' as $$begin
 if exists(select 1 from public.setups where strategy_version_id=old.id) or exists(select 1 from public.backtest_freezes where strategy_version_id=old.id) then raise exception 'Evaluated strategy versions are immutable' using errcode='42501';end if;
 return new;
end$$;
revoke all on function tradepath_private.guard_strategy() from public,anon,authenticated;
create trigger strategy_immutable before update on public.strategy_versions for each row execute function tradepath_private.guard_strategy();

create function tradepath_private.session_stage_at(p_user uuid,p_at timestamptz) returns text language sql stable set search_path='' as $$
 select a.after_jsonb->>'status' from public.audit_events a join public.daily_sessions d on d.id=a.entity_id and d.user_id=a.user_id join public.profiles p on p.user_id=d.user_id
 where a.user_id=p_user and a.entity_type='daily_session' and a.verb='check_in' and a.occurred_at<=p_at and d.local_date=(p_at at time zone p.timezone)::date order by a.occurred_at desc,a.event_order desc limit 1
$$;
revoke all on function tradepath_private.session_stage_at(uuid,timestamptz) from public,anon,authenticated;

create function tradepath_private.journal_gate(p_user uuid,p jsonb,p_at timestamptz) returns jsonb
language plpgsql set search_path='' as $$
declare failures jsonb:='[]';missing jsonb:='[]';k text;bar jsonb;bars jsonb:=coalesce(p->'h4Candles','[]');n integer;i integer;j integer;is_high boolean;is_low boolean;highs jsonb:='[]';lows jsonb:='[]';last_at timestamptz;bar_at timestamptz;confirm_at timestamptz;last_close numeric;ema numeric;side text:=p->>'side';sgn integer;entry numeric;sl numeric;tp numeric;lots numeric;zl numeric;zh numeric;o numeric;h numeric;l numeric;c numeric;signal_at timestamptz;quote_at timestamptz;zone_at timestamptz;tested_at timestamptz;anchor numeric;opposing numeric;distance numeric;equity numeric;budget numeric;risk numeric;risk_pct numeric;cost_per_lot numeric;suggested numeric;count_entries integer:=0;count_stops integer:=0;news_at timestamptz;event_at timestamptz;checkin text;
begin
 if p_user is null then raise exception 'Authentication required' using errcode='42501';end if;
 if jsonb_typeof(p) is distinct from 'object' or p->>'mode' is null or p->>'mode' not in ('demo','backtest','free_trial') or side is null or side not in ('buy','sell') or length(coalesce(p->>'accountRef','')) not between 1 and 80 then raise exception 'Invalid setup identity' using errcode='22023';end if;
 sgn:=case when side='buy' then 1 else -1 end;
 foreach k in array array['zoneLow','zoneHigh','open','high','low','close','entry','stop','target','lots','equity','rate'] loop
  if p->>k is not null then
   if jsonb_typeof(p->k) is distinct from 'number' or (p->>k)::numeric<=0 or (p->>k)::numeric>(case when k='equity' then 1000000000 when k='rate' then 1000000 else 1000 end) then raise exception 'Invalid positive setup value: %',k using errcode='22023';end if;
   if k='lots' and (p->>k)::numeric<>round((p->>k)::numeric,5) then raise exception 'Lot precision exceeds five decimals' using errcode='22023';end if;
   if k in ('zoneLow','zoneHigh','open','high','low','close','entry','stop','target') and (p->>k)::numeric<>round((p->>k)::numeric,6) then raise exception 'Price precision exceeds six decimals' using errcode='22023';end if;
  end if;
 end loop;
 foreach k in array array['pipCost','commission','minLot','lotStep'] loop
  if jsonb_typeof(p->k) is distinct from 'number' or (p->>k)::numeric<0 or (p->>k)::numeric>1000000 or (k in ('minLot','lotStep') and (p->>k)::numeric=0) then raise exception 'Invalid cost or lot assumption' using errcode='22023';end if;
 end loop;
 if p->>'currency' is null or p->>'currency' not in ('KES','USD') or p->>'news' is null or p->>'news' not in ('clear','blocked','unknown') or length(coalesce(p->>'notes',''))>6000 or length(coalesce(p->>'rateSource',''))>200 then raise exception 'Invalid setup assumptions' using errcode='22023';end if;
 foreach k in array array['signalCloseAt','zoneCreatedAt','zoneTestedAt','entryAt','equityAt','rateAt','newsCheckedAt'] loop
  if p->>k is not null and not isfinite((p->>k)::timestamptz) then raise exception 'Invalid timestamp' using errcode='22023';end if;
 end loop;
 signal_at:=(p->>'signalCloseAt')::timestamptz;quote_at:=(p->>'entryAt')::timestamptz;zone_at:=(p->>'zoneCreatedAt')::timestamptz;tested_at:=(p->>'zoneTestedAt')::timestamptz;
 entry:=(p->>'entry')::numeric;sl:=(p->>'stop')::numeric;tp:=(p->>'target')::numeric;lots:=(p->>'lots')::numeric;zl:=(p->>'zoneLow')::numeric;zh:=(p->>'zoneHigh')::numeric;o:=(p->>'open')::numeric;h:=(p->>'high')::numeric;l:=(p->>'low')::numeric;c:=(p->>'close')::numeric;
 foreach k in array array['signalCloseAt','zoneCreatedAt','zoneTestedAt','entryAt','zoneLow','zoneHigh','open','high','low','close','entry','stop','target','lots','equity','equityAt'] loop
  if p->>k is null then missing:=missing||jsonb_build_array(k);end if;
 end loop;
 if p->>'mode'<>'backtest' and signal_at<p_at-interval '15 minutes' then failures:=failures||'"The H1 signal is stale for a current precheck."'::jsonb;end if;
 if signal_at>p_at then failures:=failures||'"The H1 candle has not closed."'::jsonb;end if;
 if quote_at<signal_at or quote_at>p_at or quote_at>signal_at+interval '15 minutes' then failures:=failures||'"Entry evidence must be from the first 15 minutes after the H1 close."'::jsonb;end if;
 if zone_at>=tested_at or tested_at<signal_at-interval '1 hour' or tested_at>signal_at then failures:=failures||'"The zone must pre-exist its H1 test."'::jsonb;end if;
 if h is not null and l is not null and (h<=l or h<greatest(o,c) or l>least(o,c)) then failures:=failures||'"H1 OHLC bounds or candle range are invalid."'::jsonb;end if;
 if zl>zh then failures:=failures||'"Zone bounds are reversed."'::jsonb;end if;
 if l>zh or h<zl then failures:=failures||'"The H1 candle did not touch the zone."'::jsonb;end if;
 if side='buy' and not(c>o and c>zh and c>(h+l)/2) or side='sell' and not(c<o and c<zl and c<(h+l)/2) then failures:=failures||'"The closed H1 candle does not confirm the direction."'::jsonb;end if;
 if jsonb_typeof(bars) is distinct from 'array' or jsonb_array_length(bars)>400 then raise exception 'Invalid H4 history' using errcode='22023';end if;
 n:=jsonb_array_length(bars);
 if n<50 then missing:=missing||'"At least 50 closed H4 candles are required for EMA50 and confirmed swings."'::jsonb;end if;
  for i in 0..n-1 loop
   bar:=bars->i;
   foreach k in array array['open','high','low','close'] loop
    if jsonb_typeof(bar->k) is distinct from 'number' or (bar->>k)::numeric<=0 or (bar->>k)::numeric>1000 then raise exception 'Invalid H4 price' using errcode='22023';end if;
   end loop;
   bar_at:=(bar->>'at')::timestamptz;
   if bar_at is null or not isfinite(bar_at) then raise exception 'H4 timestamp required' using errcode='22023';end if;
   if (last_at is not null and bar_at<last_at+interval '4 hours') or bar_at+interval '4 hours'>coalesce(signal_at,p_at) or (bar->>'high')::numeric<greatest((bar->>'open')::numeric,(bar->>'close')::numeric) or (bar->>'low')::numeric>least((bar->>'open')::numeric,(bar->>'close')::numeric) or (bar->>'high')::numeric<=(bar->>'low')::numeric then failures:=failures||'"H4 candles must be ordered, non-overlapping, closed, and internally valid."'::jsonb;end if;
   last_at:=bar_at;last_close:=(bar->>'close')::numeric;
   if i<50 then ema:=coalesce(ema,0)+last_close/50;else ema:=last_close*(2::numeric/51)+ema*(49::numeric/51);end if;
  end loop;
  if n>=50 then
  if last_at+interval '4 hours'<=signal_at-interval '4 hours' then failures:=failures||'"H4 history is stale at the H1 decision."'::jsonb;end if;
  for i in 2..n-3 loop
   is_high:=true;is_low:=true;
   for j in i-2..i+2 loop
    if j<>i then
     if (bars->i->>'high')::numeric<=(bars->j->>'high')::numeric then is_high:=false;end if;
     if (bars->i->>'low')::numeric>=(bars->j->>'low')::numeric then is_low:=false;end if;
    end if;
   end loop;
   confirm_at:=(bars->(i+2)->>'at')::timestamptz+interval '4 hours';
   if is_high then highs:=highs||jsonb_build_array(jsonb_build_object('price',(bars->i->>'high')::numeric,'confirmedAt',confirm_at));end if;
   if is_low then lows:=lows||jsonb_build_array(jsonb_build_object('price',(bars->i->>'low')::numeric,'confirmedAt',confirm_at));end if;
  end loop;
  if jsonb_array_length(highs)<2 or jsonb_array_length(lows)<2 then missing:=missing||'"Two confirmed H4 swing highs and lows are required."'::jsonb;
  else
   if side='buy' and not((highs->-1->>'price')::numeric>(highs->-2->>'price')::numeric and (lows->-1->>'price')::numeric>(lows->-2->>'price')::numeric and last_close>ema) or side='sell' and not((highs->-1->>'price')::numeric<(highs->-2->>'price')::numeric and (lows->-1->>'price')::numeric<(lows->-2->>'price')::numeric and last_close<ema) then failures:=failures||'"H4 confirmed structure and EMA50 do not align."'::jsonb;end if;
   anchor:=case when side='buy' then (lows->-1->>'price')::numeric else (highs->-1->>'price')::numeric end;
   confirm_at:=((case when side='buy' then lows->-1 else highs->-1 end)->>'confirmedAt')::timestamptz;
   if confirm_at>zone_at then failures:=failures||'"The zone swing was not confirmed when the zone was created."'::jsonb;end if;
   if abs(zl-(anchor-0.0002))>0.0000005 or abs(zh-(anchor+0.0002))>0.0000005 then failures:=failures||'"The H4 zone must be two pips either side of the qualifying confirmed swing."'::jsonb;end if;
   if side='buy' then select min((x->>'price')::numeric) into opposing from jsonb_array_elements(highs) x where (x->>'price')::numeric>entry;
   else select max((x->>'price')::numeric) into opposing from jsonb_array_elements(lows) x where (x->>'price')::numeric<entry;end if;
   if opposing is null then missing:=missing||'"Opposing confirmed H4 structure is unavailable."'::jsonb;
   elsif (tp-opposing)*sgn>0 then failures:=failures||'"The 2R target exceeds the nearest opposing H4 structure."'::jsonb;end if;
  end if;
 end if;
 distance:=(entry-sl)*sgn;
 if distance<=0 then failures:=failures||'"The stop is on the wrong side of entry."'::jsonb;end if;
 if side='buy' and abs(sl-(least(zl,l)-0.0002))>0.0000005 or side='sell' and abs(sl-(greatest(zh,h)+0.0002))>0.0000005 then failures:=failures||'"Stop must include the two-pip rejection buffer."'::jsonb;end if;
 if abs((tp-entry)*sgn-distance*2)>0.0000005 then failures:=failures||'"Target must be exactly 2R before costs."'::jsonb;end if;
 if p->>'equityAt' is not null and ((p->>'equityAt')::timestamptz>coalesce(quote_at,p_at) or (p->>'equityAt')::timestamptz<coalesce(quote_at,p_at)-interval '1 hour') then missing:=missing||'"A fresh account equity reference is required."'::jsonb;end if;
 equity:=(p->>'equity')::numeric;
 if p->>'currency'='KES' then
  if p->>'rate' is null or p->>'rateAt' is null or length(coalesce(p->>'rateSource',''))=0 then missing:=missing||'"KES conversion requires a rate, source and timestamp."'::jsonb;equity:=null;
  elsif (p->>'rateAt')::timestamptz>coalesce(quote_at,p_at) or (p->>'rateAt')::timestamptz<coalesce(quote_at,p_at)-interval '24 hours' then missing:=missing||'"The exchange-rate reference is stale."'::jsonb;equity:=null;
  else equity:=equity/(p->>'rate')::numeric;end if;
 end if;
 budget:=equity*0.005;cost_per_lot:=(abs(entry-sl)*10000+(p->>'pipCost')::numeric)*10+(p->>'commission')::numeric;
 risk:=cost_per_lot*lots;
 if equity>0 then risk_pct:=risk/equity*100;end if;
 if cost_per_lot>0 and budget is not null then suggested:=floor((budget/cost_per_lot)/(p->>'lotStep')::numeric)*(p->>'lotStep')::numeric;end if;
 if risk>budget then failures:=failures||'"Modeled initial loss exceeds 0.5% of demo equity."'::jsonb;end if;
 if lots<(p->>'minLot')::numeric or lots/(p->>'lotStep')::numeric<>trunc(lots/(p->>'lotStep')::numeric) then failures:=failures||'"Lot size does not meet the broker minimum and increment."'::jsonb;end if;
 if suggested<(p->>'minLot')::numeric then failures:=failures||'"The broker minimum exceeds the risk budget: skip."'::jsonb;end if;
 if p->>'news'='blocked' then failures:=failures||'"The manually checked news window is blocked."'::jsonb;
 elsif p->>'news'='unknown' then missing:=missing||'"Manually verify high-impact EUR/USD news."'::jsonb;end if;
 news_at:=(p->>'newsCheckedAt')::timestamptz;
 if news_at is null or news_at>coalesce(quote_at,p_at) or news_at<coalesce(quote_at,p_at)-interval '1 hour' then missing:=missing||'"A fresh manual news acknowledgement is required."'::jsonb;end if;
 if jsonb_typeof(p->'newsEvents') is distinct from 'array' or jsonb_array_length(p->'newsEvents')>40 then raise exception 'Invalid news-event list' using errcode='22023';end if;
 for k in select jsonb_array_elements_text(p->'newsEvents') loop
  event_at:=k::timestamptz;
  if not isfinite(event_at) then raise exception 'Invalid news time' using errcode='22023';end if;
  if abs(extract(epoch from coalesce(quote_at,p_at)-event_at))<=1800 then failures:=failures||'"A high-impact event is within 30 minutes of entry."'::jsonb;end if;
 end loop;
 if p->>'mode'='backtest' then
  if p->>'nextH1Open' is null then missing:=missing||'"Record the next historical H1 open price."'::jsonb;
  elsif (p->>'nextH1Open')::numeric<>entry or quote_at is distinct from signal_at then failures:=failures||'"Historical entry must be the next H1 candle open."'::jsonb;end if;
 else
  select count(*) into count_entries from public.trades where user_id=p_user and mode in ('demo','free_trial') and (opened_at at time zone 'Africa/Nairobi')::date=(p_at at time zone 'Africa/Nairobi')::date and opened_at<=p_at;
  select count(*) into count_stops from public.trades where user_id=p_user and mode in ('demo','free_trial') and (closed_at at time zone 'Africa/Nairobi')::date=(p_at at time zone 'Africa/Nairobi')::date and closed_at<=p_at and realised_r<=-1;
  if count_entries>=2 then failures:=failures||'"The EAT daily entry limit has been reached."'::jsonb;end if;
  if count_stops>=2 then failures:=failures||'"Two full planned losses have ended the EAT session."'::jsonb;end if;
  checkin:=tradepath_private.session_stage_at(p_user,p_at);
  if checkin='study_only' then failures:=failures||'"This session is study-only."'::jsonb;
  elsif checkin is null or checkin='planned' then missing:=missing||'"Complete the session check-in before execution."'::jsonb;end if;
 end if;
 select coalesce(jsonb_agg(distinct value order by value),'[]'::jsonb) into failures from jsonb_array_elements(failures);
 return jsonb_build_object('state',case when jsonb_array_length(failures)>0 then 'ineligible' when jsonb_array_length(missing)>0 then 'unknown' else 'eligible' end,'failures',failures,'missing',missing,'dataValid',not(failures @> '["H4 candles must be ordered, non-overlapping, closed, and internally valid."]'::jsonb or failures @> '["The H1 candle has not closed."]'::jsonb or failures @> '["H1 OHLC bounds or candle range are invalid."]'::jsonb),'rulesVersion','H4H1-v1','ema50',ema,'riskUSD',risk,'riskPercent',risk_pct,'suggestedLots',suggested,'dailyEntries',count_entries,'dailyStopouts',count_stops);
end$$;
revoke all on function tradepath_private.journal_gate(uuid,jsonb,timestamptz) from public,anon,authenticated;
create function public.evaluate_and_save_setup(p_operation uuid,p_input jsonb,p_previous uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old_setup public.setups;op public.journal_operations;v_strategy uuid;v_rules jsonb:='{"code":"H4H1-v1","risk_percent":0.5,"max_daily_entries":2,"max_daily_stopouts":2,"swing_confirmation_bars":2,"zone_buffer_pips":2,"stop_buffer_pips":2,"target_r":2,"news_window_minutes":30,"entry_window_minutes":15,"ema_period":50,"experimental":true}';at_time timestamptz;result jsonb;fingerprint text;v_id uuid;root uuid;rev integer:=0;seq integer;v_freeze public.backtest_freezes;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_operation is null then raise exception 'Operation required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,3));
 if not exists(select 1 from public.profiles where user_id=u) then raise exception 'Complete onboarding first';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('kind','setup','input',p_input,'previous',p_previous)::text,'UTF8')),'hex');
 select * into op from public.journal_operations where user_id=u and operation_id=p_operation;
 if found then if op.fingerprint<>fingerprint then raise exception 'Operation reused with different inputs' using errcode='22023';end if;return op.result_id;end if;
 at_time:=case when p_input->>'mode'='backtest' then (p_input->>'decisionAt')::timestamptz else now() end;
 if at_time is null or not isfinite(at_time) or at_time>now() then raise exception 'A completed historical decision time is required' using errcode='22023';end if;
 if p_input->>'mode'='backtest' and (p_input->>'dataset' is null or p_input->>'dataset' not in ('development','held_out')) or p_input->>'mode'<>'backtest' and p_input->>'dataset' is not null then raise exception 'Invalid dataset' using errcode='22023';end if;
 select id into v_strategy from public.strategy_versions where user_id=u and code='H4H1' and version=1;
 if v_strategy is null then raise exception 'Strategy version is unavailable';end if;
 if not exists(select 1 from public.setups where strategy_version_id=v_strategy) and not exists(select 1 from public.backtest_freezes where user_id=u) then update public.strategy_versions set params=v_rules where id=v_strategy;end if;
 if (select params from public.strategy_versions where id=v_strategy)<>v_rules then raise exception 'The historical strategy version is unsupported';end if;
 select * into v_freeze from public.backtest_freezes where user_id=u;
 if p_input->>'dataset'='development' and v_freeze.id is not null then raise exception 'Development rules are frozen. Use untouched held-out candidates.' using errcode='22023';end if;
 if p_input->>'dataset'='held_out' and (v_freeze.id is null or v_freeze.strategy_version_id<>v_strategy or (p_input->>'signalCloseAt')::timestamptz<=v_freeze.cutoff_signal) then raise exception 'Held-out candidates require a freeze and later untouched signals' using errcode='22023';end if;
 if p_previous is not null then
  select * into old_setup from public.setups where id=p_previous and user_id=u;
  if not found then raise exception 'Setup not found' using errcode='42501';end if;
  if old_setup.dataset_split='held_out' then raise exception 'Held-out evidence is immutable' using errcode='22023';end if;
  if exists(select 1 from public.setups where supersedes_id=old_setup.id) then raise exception 'This setup already has a newer revision' using errcode='40001';end if;
  if old_setup.mode is distinct from p_input->>'mode' or old_setup.direction is distinct from p_input->>'side' or old_setup.account_ref is distinct from p_input->>'accountRef' or old_setup.dataset_split is distinct from p_input->>'dataset' or (old_setup.signal_close_at is not null and old_setup.signal_close_at is distinct from (p_input->>'signalCloseAt')::timestamptz) then raise exception 'A revision must preserve candidate identity' using errcode='22023';end if;
  root:=old_setup.candidate_id;rev:=old_setup.revision+1;seq:=old_setup.sequence_no;
 else
  root:=gen_random_uuid();
  if p_input->>'mode'='backtest' then
   if (p_input->>'signalCloseAt') is null then raise exception 'Historical candidates need a signal time' using errcode='22023';end if;
   if exists(select 1 from public.setups where user_id=u and mode='backtest' and signal_close_at=(p_input->>'signalCloseAt')::timestamptz and direction=p_input->>'side') then raise exception 'This historical candidate is already recorded; use a revision if permitted' using errcode='23505';end if;
   if (p_input->>'signalCloseAt')::timestamptz<=(select max(signal_close_at) from public.setups where user_id=u and dataset_split=p_input->>'dataset') then raise exception 'Historical candidates must be sequential in signal time' using errcode='22023';end if;
   select coalesce(max(sequence_no),0)+1 into seq from public.setups where user_id=u and dataset_split=p_input->>'dataset';
  end if;
 end if;
 result:=tradepath_private.journal_gate(u,p_input,at_time);
 insert into public.setups(user_id,strategy_version_id,mode,direction,signal_close_at,zone_created_at,zone_low,zone_high,candle_open,candle_high,candle_low,candle_close,entry,stop,target,volume_lots,cost_model,eligibility,rule_snapshot,failures,candidate_id,revision,supersedes_id,account_ref,dataset_split,sequence_no,client_operation_id)
 values(u,v_strategy,p_input->>'mode',p_input->>'side',(p_input->>'signalCloseAt')::timestamptz,(p_input->>'zoneCreatedAt')::timestamptz,(p_input->>'zoneLow')::numeric,(p_input->>'zoneHigh')::numeric,(p_input->>'open')::numeric,(p_input->>'high')::numeric,(p_input->>'low')::numeric,(p_input->>'close')::numeric,(p_input->>'entry')::numeric,(p_input->>'stop')::numeric,(p_input->>'target')::numeric,(p_input->>'lots')::numeric,jsonb_build_object('pipCost',p_input->'pipCost','commission',p_input->'commission'),result->>'state',jsonb_build_object('input',p_input,'result',result,'rules',v_rules,'decisionAt',at_time),result->'failures',root,rev,p_previous,p_input->>'accountRef',p_input->>'dataset',seq,p_operation) returning id into v_id;
 insert into public.gate_evaluations(user_id,setup_id,rules_version,state,reasons,inputs_hash) values(u,v_id,'H4H1-v1',result->>'state',jsonb_build_object('failures',result->'failures','missing',result->'missing'),encode(sha256(convert_to(jsonb_build_object('input',p_input,'rules',v_rules,'result',result)::text,'UTF8')),'hex'));
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(u,'setup',v_id,case when p_previous is null then 'evaluated' else 'revised' end,jsonb_build_object('state',result->>'state','supersedes',p_previous,'rules','H4H1-v1'));
 insert into public.journal_operations(user_id,operation_id,fingerprint,result_id) values(u,p_operation,fingerprint,v_id);
 return v_id;
end$$;

create function public.freeze_backtest_development() returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v_count integer;v_strategy uuid;v_cutoff timestamptz;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,3));
 if exists(select 1 from public.backtest_freezes where user_id=u) then return;end if;
 select count(*),max(s.signal_close_at) into v_count,v_cutoff from public.setups s where s.user_id=u and s.dataset_split='development' and not exists(select 1 from public.setups r where r.supersedes_id=s.id) and s.rule_snapshot->'result'->'missing'='[]'::jsonb and s.rule_snapshot->'result'->>'dataValid'='true';
 if v_count<70 then raise exception 'At least 70 fully documented development candidates are required' using errcode='22023';end if;
 select id into v_strategy from public.strategy_versions where user_id=u and code='H4H1' and version=1;
 insert into public.backtest_freezes(user_id,strategy_version_id,cutoff_signal) values(u,v_strategy,v_cutoff);
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(u,'strategy',v_strategy,'development_frozen',jsonb_build_object('candidates',v_count,'cutoff',v_cutoff));
end$$;

create function public.record_journal_trade(p_operation uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.setups;g public.gate_evaluations;op public.journal_operations;fp text;v_id uuid;v_entry numeric;v_stop numeric;v_lots numeric;v_cost numeric;v_risk numeric;v_open timestamptz;v_compliant boolean:=null;reasons jsonb:='[]';ctx jsonb;v_mode text;v_side text;v_count integer;v_losses integer;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,3));
 if p_operation is null or not exists(select 1 from public.profiles where user_id=u) then raise exception 'Invalid journal operation' using errcode='22023';end if;
 fp:=encode(sha256(convert_to(jsonb_build_object('kind','trade','input',p)::text,'UTF8')),'hex');
 select * into op from public.journal_operations where user_id=u and operation_id=p_operation;
 if found then if op.fingerprint<>fp then raise exception 'Operation reused with different inputs' using errcode='22023';end if;return op.result_id;end if;
 v_mode:=p->>'mode';v_side:=p->>'side';v_entry:=(p->>'entry')::numeric;v_stop:=(p->>'stop')::numeric;v_lots:=(p->>'lots')::numeric;v_cost:=(p->>'costUSD')::numeric;v_open:=(p->>'openedAt')::timestamptz;
 if v_mode is null or v_mode not in ('demo','backtest','free_trial') or v_side is null or v_side not in ('buy','sell') or v_entry is null or v_entry<=0 or v_entry>1000 or v_lots is null or v_lots<=0 or v_lots>1000 or v_lots<>round(v_lots,5) or v_cost is null or v_cost<0 or v_cost>1000000000 or v_open is null or not isfinite(v_open) or v_open>now() or length(coalesce(p->>'accountRef','')) not between 1 and 80 or length(coalesce(p->>'notes',''))>6000 or (v_stop is not null and (v_stop<=0 or v_stop>1000 or v_stop=v_entry)) or (p->>'target' is not null and ((p->>'target')::numeric<=0 or (p->>'target')::numeric>1000)) then raise exception 'Invalid trade values' using errcode='22023';end if;
 if v_entry<>round(v_entry,6) or (v_stop is not null and v_stop<>round(v_stop,6)) or (p->>'target' is not null and (p->>'target')::numeric<>round((p->>'target')::numeric,6)) then raise exception 'Unsupported price precision' using errcode='22023';end if;
 v_cost:=round(v_cost,4);
 if v_stop is not null then v_risk:=round(abs(v_entry-v_stop)*100000*v_lots+v_cost,4);if v_risk<=0 then raise exception 'Initial risk is below supported precision' using errcode='22023';end if;end if;
 if p->>'setupId' is not null then
  select * into s from public.setups where id=(p->>'setupId')::uuid and user_id=u;
  if not found then raise exception 'Setup not found' using errcode='42501';end if;
  if s.mode<>v_mode or s.direction<>v_side or s.account_ref<>p->>'accountRef' then raise exception 'Setup identity does not match this trade' using errcode='22023';end if;
  if exists(select 1 from public.trades t join public.setups linked on linked.id=t.setup_id where t.user_id=u and linked.candidate_id=s.candidate_id) then raise exception 'An execution is already recorded for this candidate' using errcode='23505';end if;
  select * into g from public.gate_evaluations where setup_id=s.id and user_id=u order by evaluated_at desc limit 1;
  if v_mode<>'backtest' and (g.evaluated_at>v_open or v_open>g.evaluated_at+interval '15 minutes') then reasons:=reasons||'"No timely pre-execution gate was recorded."'::jsonb;end if;
  if v_entry is distinct from s.entry or v_stop is distinct from s.stop or (p->>'target')::numeric is distinct from s.target or v_lots is distinct from s.volume_lots then reasons:=reasons||'"Execution deviated from the evaluated entry, stop, target or volume."'::jsonb;end if;
  if v_mode='backtest' and v_open is distinct from s.signal_close_at then reasons:=reasons||'"Historical execution time is not the next H1 open."'::jsonb;end if;
  if s.entry is not null and s.stop is not null and s.rule_snapshot->'result'->>'riskUSD' is not null then
   v_risk:=round(abs(v_entry-v_stop)*100000*v_lots+greatest(((s.rule_snapshot->'input'->>'pipCost')::numeric*10+(s.rule_snapshot->'input'->>'commission')::numeric)*v_lots,v_cost),4);
   if v_risk<=0 then raise exception 'Initial risk is below supported precision' using errcode='22023';end if;
  end if;
  ctx:=tradepath_private.journal_gate(u,s.rule_snapshot->'input',case when v_mode='backtest' then (s.rule_snapshot->>'decisionAt')::timestamptz else v_open end);
  if s.eligibility='ineligible' or ctx->>'state'='ineligible' then reasons:=reasons||coalesce(ctx->'failures','[]');v_compliant:=false;
  elsif s.eligibility='eligible' and ctx->>'state'='eligible' and jsonb_array_length(reasons)=0 then v_compliant:=true;end if;
 else reasons:=reasons||'"No immutable setup gate is attached; adherence is unassessed."'::jsonb;end if;
 if v_mode<>'backtest' then
  select count(*) into v_count from public.trades where user_id=u and mode in ('demo','free_trial') and (opened_at at time zone 'Africa/Nairobi')::date=(v_open at time zone 'Africa/Nairobi')::date and opened_at<=v_open;
  select count(*) into v_losses from public.trades where user_id=u and mode in ('demo','free_trial') and (closed_at at time zone 'Africa/Nairobi')::date=(v_open at time zone 'Africa/Nairobi')::date and closed_at<=v_open and realised_r<=-1;
  if tradepath_private.session_stage_at(u,v_open)='study_only' then reasons:=reasons||'"Execution occurred during a study-only check-in."'::jsonb;v_compliant:=false;end if;
  if v_count>=2 or v_losses>=2 then reasons:=reasons||'"Execution breached the EAT daily entry or full-loss limit."'::jsonb;v_compliant:=false;end if;
 end if;
 if s.id is not null and v_risk is not null and s.rule_snapshot->'input'->>'equity' is not null then
  if v_risk>((s.rule_snapshot->'input'->>'equity')::numeric/case when s.rule_snapshot->'input'->>'currency'='KES' then (s.rule_snapshot->'input'->>'rate')::numeric else 1 end)*0.005 then reasons:=reasons||'"Actual modeled loss exceeds the selected equity risk budget."'::jsonb;v_compliant:=false;end if;
 end if;
 if v_stop is null then reasons:=reasons||'"Initial protective stop and risk are unknown."'::jsonb;v_risk:=null;v_compliant:=false;
 elsif (v_side='buy' and v_stop>=v_entry) or (v_side='sell' and v_stop<=v_entry) then reasons:=reasons||'"Initial stop orientation breaches the rules."'::jsonb;v_compliant:=false;end if;
 if jsonb_array_length(reasons)>0 and s.id is not null then v_compliant:=false;end if;
 insert into public.trades(user_id,setup_id,mode,side,account_ref,opened_at,entry,stop,target,volume_lots,cost_usd,planned_risk_usd,rule_compliant,breach_reasons,notes,client_operation_id)
 values(u,s.id,v_mode,v_side,p->>'accountRef',v_open,v_entry,v_stop,(p->>'target')::numeric,v_lots,v_cost,v_risk,v_compliant,reasons,p->>'notes',p_operation) returning id into v_id;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(u,'trade',v_id,'opened',jsonb_build_object('compliant',v_compliant,'breaches',reasons,'initial_risk_usd',v_risk));
 insert into public.journal_operations(user_id,operation_id,fingerprint,result_id) values(u,p_operation,fp,v_id);
 return v_id;
end$$;

create function public.close_journal_trade(p_operation uuid,p_trade uuid,p_revision integer,p_closed timestamptz,p_exit numeric,p_cost numeric,p_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t public.trades;op public.journal_operations;fp text;pnl numeric;r numeric;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,3));
 fp:=encode(sha256(convert_to(jsonb_build_object('kind','close','trade',p_trade,'revision',p_revision,'closed',p_closed,'exit',p_exit,'cost',p_cost,'notes',p_notes)::text,'UTF8')),'hex');
 if p_operation is null then raise exception 'Operation required' using errcode='22023';end if;
 select * into op from public.journal_operations where user_id=u and operation_id=p_operation;
 if found then if op.fingerprint<>fp then raise exception 'Operation reused with different inputs' using errcode='22023';end if;return;end if;
 select * into t from public.trades where id=p_trade and user_id=u for update;
 if not found then raise exception 'Trade not found' using errcode='42501';end if;
 if p_revision is null or t.revision<>p_revision then raise exception 'Trade changed elsewhere. Reload before editing.' using errcode='40001';end if;
 if p_closed is null or not isfinite(p_closed) or p_closed<t.opened_at or p_closed>now() or p_exit is null or p_exit<=0 or p_exit>1000 or p_exit::text in ('NaN','Infinity','-Infinity') or p_cost is null or p_cost<0 or p_cost>1000000000 or p_cost::text in ('NaN','Infinity','-Infinity') or p_notes is null or length(p_notes)>6000 then raise exception 'Invalid closing values' using errcode='22023';end if;
 if p_exit<>round(p_exit,6) then raise exception 'Unsupported exit-price precision' using errcode='22023';end if;
 p_cost:=round(p_cost,4);
 pnl:=round((p_exit-t.entry)*(case when t.side='buy' then 1 else -1 end)*100000*t.volume_lots-p_cost,4);
 r:=case when t.planned_risk_usd>0 then round(pnl/t.planned_risk_usd,6) else null end;
 update public.trades set closed_at=p_closed,exit=p_exit,cost_usd=p_cost,realised_pnl_usd=pnl,realised_r=r,notes=p_notes,revision=revision+1,updated_at=now() where id=t.id;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,before_hash,after_jsonb) values(u,'trade',t.id,case when t.closed_at is null then 'closed' else 'result_corrected' end,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),jsonb_build_object('previous',to_jsonb(t),'closed_at',p_closed,'exit',p_exit,'cost_usd',p_cost,'net_pnl_usd',pnl,'r',r,'notes',p_notes));
 insert into public.journal_operations(user_id,operation_id,fingerprint,result_id) values(u,p_operation,fp,t.id);
end$$;
revoke all on function public.evaluate_and_save_setup(uuid,jsonb,uuid),public.freeze_backtest_development(),public.record_journal_trade(uuid,jsonb),public.close_journal_trade(uuid,uuid,integer,timestamptz,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.evaluate_and_save_setup(uuid,jsonb,uuid),public.freeze_backtest_development(),public.record_journal_trade(uuid,jsonb),public.close_journal_trade(uuid,uuid,integer,timestamptz,numeric,numeric,text) to authenticated;
commit;
