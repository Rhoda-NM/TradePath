begin;
create table public.screenshots (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 parent_type text not null check(parent_type in ('setup','trade')),parent_id uuid not null,
 storage_path text not null unique,content_type text not null check(content_type in ('image/png','image/jpeg','image/webp')),
 bytes integer not null check(bytes>0 and bytes<=5242880),created_at timestamptz not null default now()
);
alter table public.screenshots enable row level security;
revoke all on public.screenshots from public,anon,authenticated;
grant select on public.screenshots to authenticated;
create policy owner_read on public.screenshots for select to authenticated using(user_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tradepath-journal','tradepath-journal',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy tradepath_private_read on storage.objects for select to authenticated using(bucket_id='tradepath-journal' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy tradepath_private_upload on storage.objects for insert to authenticated with check(
 bucket_id='tradepath-journal' and (storage.foldername(name))[1]=(select auth.uid())::text and
 (((storage.foldername(name))[2]='setup' and exists(select 1 from public.setups where id::text=(storage.foldername(name))[3] and user_id=(select auth.uid()))) or
 ((storage.foldername(name))[2]='trade' and exists(select 1 from public.trades where id::text=(storage.foldername(name))[3] and user_id=(select auth.uid()))))
);
-- Only unattached failed uploads can be removed by the application role.
create policy tradepath_private_cleanup on storage.objects for delete to authenticated using(bucket_id='tradepath-journal' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.screenshots where storage_path=name and user_id=(select auth.uid())));
create function public.attach_journal_screenshot(p_id uuid,p_type text,p_parent uuid,p_path text,p_content_type text,p_bytes integer) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_id is null or p_type is null or p_type not in ('setup','trade') or p_bytes is null or p_bytes not between 1 and 5242880 or p_content_type is null or p_content_type not in ('image/png','image/jpeg','image/webp') or p_path is null or p_path not like u::text||'/'||p_type||'/'||p_parent::text||'/%' or p_path like '%..%' then raise exception 'Invalid screenshot metadata' using errcode='22023';end if;
 if p_type='setup' and not exists(select 1 from public.setups where id=p_parent and user_id=u) or p_type='trade' and not exists(select 1 from public.trades where id=p_parent and user_id=u) then raise exception 'Parent not found' using errcode='42501';end if;
 if not exists(select 1 from storage.objects where bucket_id='tradepath-journal' and name=p_path and metadata->>'mimetype'=p_content_type and (metadata->>'size')::bigint=p_bytes) then raise exception 'Uploaded object not found' using errcode='22023';end if;
 if exists(select 1 from public.screenshots where id=p_id and user_id=u and storage_path=p_path) then return;end if;
 insert into public.screenshots(id,user_id,parent_type,parent_id,storage_path,content_type,bytes) values(p_id,u,p_type,p_parent,p_path,p_content_type,p_bytes);
 insert into public.audit_events(user_id,entity_type,entity_id,verb,after_jsonb) values(u,'screenshot',p_id,'attached',jsonb_build_object('parent_type',p_type,'parent_id',p_parent));
end$$;
revoke all on function public.attach_journal_screenshot(uuid,text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.attach_journal_screenshot(uuid,text,uuid,text,text,integer) to authenticated;
commit;
