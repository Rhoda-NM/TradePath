begin;
alter table public.equity_snapshots add column cashflows_confirmed boolean not null default false;
alter table public.equity_snapshots add column notes text not null default '';
alter table public.equity_snapshots add column revision bigint not null default 0;
-- The same owner-scoped operation ledger as the journal protects retries.
create function public.save_equity_snapshot(p_operation uuid,p_id uuid,p_revision bigint,p_mode text,p_account text,p_at timestamptz,p_balance numeric,p_equity numeric,p_deposits numeric,p_withdrawals numeric,p_confirmed boolean,p_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();old public.equity_snapshots;op public.journal_operations;fp text;v_id uuid;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_operation is null or p_revision is null or p_revision<0 or p_mode is null or p_mode not in ('demo','free_trial') or p_account is null or length(btrim(p_account)) not between 1 and 80 or p_at is null or not isfinite(p_at) or p_at>now() or p_at<timestamptz '2020-01-01' or p_balance is null or p_equity is null or p_deposits is null or p_withdrawals is null or p_confirmed is null or p_notes is null or length(p_notes)>2000 then raise exception 'Invalid equity record' using errcode='22023';end if;
 if p_balance::text in ('NaN','Infinity','-Infinity') or p_equity::text in ('NaN','Infinity','-Infinity') or p_deposits::text in ('NaN','Infinity','-Infinity') or p_withdrawals::text in ('NaN','Infinity','-Infinity') or abs(p_balance)>1000000000 or abs(p_equity)>1000000000 or p_deposits<0 or p_deposits>1000000000 or p_withdrawals<0 or p_withdrawals>1000000000 or round(p_balance,4)<>p_balance or round(p_equity,4)<>p_equity or round(p_deposits,4)<>p_deposits or round(p_withdrawals,4)<>p_withdrawals then raise exception 'Invalid amounts' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 fp:=encode(sha256(convert_to(jsonb_build_array('equity',p_id,p_revision,p_mode,btrim(p_account),p_at,p_balance,p_equity,p_deposits,p_withdrawals,p_confirmed,btrim(p_notes))::text,'UTF8')),'hex');
 select * into op from public.journal_operations where user_id=u and operation_id=p_operation;
 if found then
  if op.fingerprint<>fp then raise exception 'Operation reused' using errcode='22023';end if;
  return op.result_id;
 end if;
 if p_id is not null then
  select * into old from public.equity_snapshots where id=p_id and user_id=u for update;
  if not found then raise exception 'Record not found' using errcode='42501';end if;
  if old.revision<>p_revision then raise exception 'Record changed elsewhere' using errcode='40001';end if;
  if old.account_mode<>p_mode or old.account_ref<>btrim(p_account) or old.at<>p_at then raise exception 'Account and timestamp are immutable' using errcode='22023';end if;
  update public.equity_snapshots set balance_usd=p_balance,equity_usd=p_equity,deposits_usd=p_deposits,withdrawals_usd=p_withdrawals,cashflows_confirmed=p_confirmed,notes=btrim(p_notes),revision=revision+1 where id=old.id returning id into v_id;
 else
  if p_revision<>0 then raise exception 'Invalid revision' using errcode='22023';end if;
  insert into public.equity_snapshots(user_id,account_mode,account_ref,at,balance_usd,equity_usd,deposits_usd,withdrawals_usd,cashflows_confirmed,notes) values(u,p_mode,btrim(p_account),p_at,p_balance,p_equity,p_deposits,p_withdrawals,p_confirmed,btrim(p_notes)) returning id into v_id;
 end if;
 insert into public.journal_operations(user_id,operation_id,fingerprint,result_id) values(u,p_operation,fp,v_id);
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(u,'equity_snapshot',v_id,case when p_id is null then 'created' else 'corrected' end,jsonb_build_object('previous',case when p_id is not null then to_jsonb(old) else null end,'balance',p_balance,'equity',p_equity,'deposits',p_deposits,'withdrawals',p_withdrawals,'confirmed',p_confirmed));
 return v_id;
end$$;
revoke all on function public.save_equity_snapshot(uuid,uuid,bigint,text,text,timestamptz,numeric,numeric,numeric,numeric,boolean,text) from public,anon,authenticated;
grant execute on function public.save_equity_snapshot(uuid,uuid,bigint,text,text,timestamptz,numeric,numeric,numeric,numeric,boolean,text) to authenticated;

-- Keep existing review facts and append account-specific results. Submitted
-- review facts remain frozen until the user explicitly updates that review.
alter function public.weekly_review_facts(date) rename to weekly_practice_facts;
revoke all on function public.weekly_practice_facts(date) from public,anon,authenticated;
create function public.weekly_review_facts(p_week date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();base jsonb;accounts jsonb;v_from timestamptz;v_to timestamptz;
begin
 base:=public.weekly_practice_facts(p_week);
 v_from:=p_week::timestamp at time zone 'Africa/Nairobi';v_to:=(p_week+7)::timestamp at time zone 'Africa/Nairobi';
 select coalesce(jsonb_agg(x),'[]') into accounts from (
 select t.mode,t.account_ref,
 count(*) filter(where t.closed_at>=v_from and t.closed_at<v_to) as closed,
 count(*) filter(where t.closed_at>=v_from and t.closed_at<v_to and t.realised_r is not null) as r_sample,
 sum(t.realised_pnl_usd) filter(where t.closed_at>=v_from and t.closed_at<v_to) as net_usd,
 count(*) filter(where t.closed_at>=v_from and t.closed_at<v_to and s.eligibility='eligible' and t.realised_r is not null) as eligible_r_sample,
 avg(t.realised_r) filter(where t.closed_at>=v_from and t.closed_at<v_to and s.eligibility='eligible') as eligible_average_r,
 count(*) filter(where t.opened_at>=v_from and t.opened_at<v_to and t.rule_compliant=false) as breaches
 from public.trades t left join public.setups s on s.id=t.setup_id and s.user_id=u where t.user_id=u and ((t.opened_at>=v_from and t.opened_at<v_to) or (t.closed_at>=v_from and t.closed_at<v_to)) group by t.mode,t.account_ref order by t.mode,t.account_ref) x;
 return base||jsonb_build_object('journal_accounts',accounts);
end$$;
revoke all on function public.weekly_review_facts(date) from public,anon,authenticated;
grant execute on function public.weekly_review_facts(date) to authenticated;
commit;
