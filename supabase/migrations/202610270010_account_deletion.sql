begin;
-- Queue metadata survives Auth deletion until the worker confirms completion.
create table public.account_deletions(user_id uuid primary key,requested_at timestamptz not null default now());
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from public,anon,authenticated;
grant select on public.account_deletions to authenticated;
create policy owner_read on public.account_deletions for select to authenticated using(user_id=(select auth.uid()));
-- Check the current session's creation time, not a different device's last login.
create function public.recent_account_sign_in() returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where user_id=auth.uid() and id=(auth.jwt()->>'session_id')::uuid and created_at>=now()-interval '15 minutes' and created_at<=now())
$$;
revoke all on function public.recent_account_sign_in() from public,anon,authenticated;
grant execute on function public.recent_account_sign_in() to authenticated;
-- Only the server admin, after recent-auth and explicit confirmation, can queue.
create function public.queue_account_deletion(p_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'User not found' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 insert into public.account_deletions(user_id) values(p_user) on conflict(user_id) do nothing;
end$$;
-- Block new writes once deletion is committed, including direct Storage uploads.
create function tradepath_private.block_deleting_account() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 u:=new.user_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 if exists(select 1 from public.account_deletions where user_id=u) then raise exception 'Account deletion is pending' using errcode='42501';end if;
 return new;
end$$;
revoke all on function tradepath_private.block_deleting_account() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['profiles','strategy_versions','curriculum_phases','daily_sessions','daily_tasks','setups','trades','no_trade_decisions','weekly_reviews','equity_snapshots','funding_evaluations','gate_evaluations','audit_events','learning_evidence','lesson_progress','backtest_freezes','journal_operations','screenshots'] loop
 execute format('create trigger block_deleting_account before insert or update on public.%I for each row execute function tradepath_private.block_deleting_account()',t);
 end loop;
end$$;
-- Restrictive Storage policies avoid changing the provider-owned table/triggers.
create function public.journal_upload_allowed(p_bucket text,p_path text) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if p_bucket<>'tradepath-journal' then return true;end if;
 if u is null or split_part(p_path,'/',1)<>u::text then return false;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 return not exists(select 1 from public.account_deletions where user_id=u);
end$$;
revoke all on function public.journal_upload_allowed(text,text) from public,anon,authenticated;
grant execute on function public.journal_upload_allowed(text,text) to authenticated;
create policy tradepath_deletion_insert_lock on storage.objects as restrictive for insert to authenticated with check(public.journal_upload_allowed(bucket_id,name));
create policy tradepath_deletion_update_lock on storage.objects as restrictive for update to authenticated using(public.journal_upload_allowed(bucket_id,name)) with check(public.journal_upload_allowed(bucket_id,name));
-- Immutable evidence can only disappear through an Auth-owner cascade after a
-- confirmed deletion request. Ordinary updates/deletes remain forbidden.
create or replace function tradepath_private.guard_history() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='DELETE' and exists(select 1 from public.account_deletions where user_id=old.user_id) and not exists(select 1 from auth.users where id=old.user_id) then return old;end if;
 raise exception 'Historical evidence is immutable; create a new revision.' using errcode='42501';
end$$;
create function public.deletion_jobs() returns setof uuid language sql security definer set search_path='' as $$select user_id from public.account_deletions order by requested_at limit 10$$;
create function public.deletion_objects(p_user uuid) returns table(name text) language sql security definer set search_path='' as $$
 select o.name from storage.objects o where o.bucket_id='tradepath-journal' and split_part(o.name,'/',1)=p_user::text and exists(select 1 from public.account_deletions where user_id=p_user) order by o.name limit 100
$$;
create function public.finish_account_deletion(p_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from auth.users where id=p_user) or exists(select 1 from storage.objects where bucket_id='tradepath-journal' and split_part(name,'/',1)=p_user::text) then raise exception 'Deletion not complete' using errcode='22023';end if;
 delete from public.account_deletions where user_id=p_user;
end$$;
revoke all on function public.queue_account_deletion(uuid),public.deletion_jobs(),public.deletion_objects(uuid),public.finish_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.queue_account_deletion(uuid),public.deletion_jobs(),public.deletion_objects(uuid),public.finish_account_deletion(uuid) to service_role;
commit;
