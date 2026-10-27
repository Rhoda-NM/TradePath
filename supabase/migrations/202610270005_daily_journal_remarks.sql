begin;
-- Reuse the existing daily_sessions.reflection field. Ownership is never supplied
-- by the client; a row lock and expected text prevent overwriting other edits.
create function public.save_daily_remarks(p_date date,p_notes text,p_expected_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_session uuid;v_previous text;
begin
 v_session:=tradepath_private.ensure_day(p_date);
 if p_notes is null or p_expected_notes is null or length(p_notes)>6000 or length(p_expected_notes)>6000 then raise exception 'Invalid daily remarks' using errcode='22023';end if;
 select coalesce(reflection,'') into v_previous from public.daily_sessions where id=v_session and user_id=v_user for update;
 if v_previous=btrim(p_notes) then return;end if;
 if v_previous<>p_expected_notes then raise exception 'Remarks changed elsewhere. Reload before saving.' using errcode='40001';end if;
 update public.daily_sessions set reflection=nullif(btrim(p_notes),''),updated_at=now() where id=v_session and user_id=v_user;
 insert into public.audit_events(user_id,entity_type,entity_id,verb,before_hash,after_jsonb)
 values(v_user,'daily_session',v_session,'remarks_updated',md5(v_previous),jsonb_build_object('date',p_date,'previous_remarks',v_previous,'remarks',btrim(p_notes)));
end $$;
revoke all on function public.save_daily_remarks(date,text,text) from public,anon,authenticated;
grant execute on function public.save_daily_remarks(date,text,text) to authenticated;
commit;
