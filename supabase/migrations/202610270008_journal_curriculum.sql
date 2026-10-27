begin;
create function public.journal_evidence_counts() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v_dev integer;v_held integer;v_dev_results integer;v_held_results integer;v_forward jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 select count(*) filter(where s.dataset_split='development'),count(*) filter(where s.dataset_split='held_out') into v_dev,v_held from public.setups s where s.user_id=u and not exists(select 1 from public.setups r where r.supersedes_id=s.id) and s.rule_snapshot->'result'->'missing'='[]'::jsonb and s.rule_snapshot->'result'->>'dataValid'='true';
 select count(*) filter(where s.dataset_split='development'),count(*) filter(where s.dataset_split='held_out') into v_dev_results,v_held_results from public.trades t join public.setups s on s.id=t.setup_id where t.user_id=u and s.user_id=u and t.mode='backtest' and t.closed_at is not null and t.realised_r is not null and s.rule_snapshot->'result'->'missing'='[]'::jsonb and s.rule_snapshot->'result'->>'dataValid'='true';
 select coalesce(jsonb_agg(x),'[]') into v_forward from (select account_ref,count(*) filter(where closed_at is not null) as closed_trades,count(*) filter(where closed_at is not null and rule_compliant=true) as prechecked_trades from public.trades where user_id=u and mode='demo' group by account_ref order by account_ref) x;
 return jsonb_build_object('development',v_dev,'held_out',v_held,'development_results',v_dev_results,'held_out_results',v_held_results,'frozen',exists(select 1 from public.backtest_freezes where user_id=u),'forward_accounts',v_forward);
end$$;
revoke all on function public.journal_evidence_counts() from public,anon,authenticated;
grant execute on function public.journal_evidence_counts() to authenticated;
create or replace function tradepath_private.refresh_learning(p_user uuid) returns void
language plpgsql set search_path='' as $$
declare p public.curriculum_phases;v_current boolean:=false;v_complete boolean;v_prior boolean:=true;v_lessons boolean;v_today date;v_next text;v_evidence jsonb;
begin
 select (now() at time zone timezone)::date into v_today from public.profiles where user_id=p_user;
 if v_today is null then raise exception 'Complete onboarding first';end if;
 -- The only callers derive p_user from auth.uid(); never expose this helper.
 if p_user is distinct from auth.uid() then raise exception 'Owner mismatch' using errcode='42501';end if;
 v_evidence:=public.journal_evidence_counts();
 insert into public.lesson_progress(user_id,lesson_id,state,evidence_count,completed_at)
 select p_user,l.id,case when count(e.id)>=l.required_count then 'completed' else 'in_progress' end,count(e.id)::integer,case when count(e.id)>=l.required_count then max(e.created_at) else null end
 from public.lessons l left join public.learning_evidence e on e.lesson_code=l.code and e.user_id=p_user group by l.id having count(e.id)>0
 on conflict(user_id,lesson_id) do update set state=excluded.state,evidence_count=excluded.evidence_count,completed_at=excluded.completed_at,updated_at=now();
 for p in select * from public.curriculum_phases where user_id=p_user order by phase_number for update loop
  select not exists(select 1 from public.lessons l where l.phase_number=p.phase_number and (select count(*) from public.learning_evidence e where e.user_id=p_user and e.lesson_code=l.code)<l.required_count) into v_lessons;
  v_complete:=v_prior and v_lessons and (p.phase_number=1 or (p.phase_number=2 and (v_evidence->>'development')::integer>=70 and (v_evidence->>'held_out')::integer>=30 and (v_evidence->>'frozen')::boolean and (v_evidence->>'development_results')::integer>0 and (v_evidence->>'held_out_results')::integer>0));
  if v_complete then v_next:='completed';elsif not v_current then v_current:=true;v_next:=case when p.planned_end<v_today then 'needs_practice' else 'active' end;else v_next:='not_started';end if;
  update public.curriculum_phases set state=v_next,verified_at=case when v_complete then coalesce(verified_at,now()) else null end where id=p.id;
  v_prior:=v_prior and v_complete;
 end loop;
end$$;

create function public.journal_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();result jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 select coalesce(jsonb_agg(x),'[]') into result from (
 select mode,account_ref,count(*) as entries,count(*) filter(where closed_at is null) as open_trades,count(*) filter(where closed_at is not null) as closed_trades,count(*) filter(where closed_at is not null and realised_r is not null) as r_sample,count(*) filter(where closed_at is not null and realised_r is null) as missing_r,
 avg(realised_r) filter(where closed_at is not null) as average_r,
 count(*) filter(where rule_compliant=false) as breaches,count(*) filter(where rule_compliant is null) as unassessed,
 sum(realised_pnl_usd) filter(where closed_at is not null) as net_pnl_usd,
 case when sum(abs(realised_pnl_usd)) filter(where realised_pnl_usd<0)>0 then coalesce(sum(realised_pnl_usd) filter(where realised_pnl_usd>0),0)/sum(abs(realised_pnl_usd)) filter(where realised_pnl_usd<0) else null end as profit_factor
 from public.trades where user_id=u group by mode,account_ref order by mode,account_ref
 ) x;
 return result;
end$$;
revoke all on function public.journal_summary() from public,anon,authenticated;
grant execute on function public.journal_summary() to authenticated;
commit;
