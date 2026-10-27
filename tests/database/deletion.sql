\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',message;end if;end$$;
insert into auth.sessions(id,user_id,created_at) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',now()),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',now()-interval '1 hour');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select pg_temp.assert_true(public.recent_account_sign_in(),'fresh current session');
select set_config('request.jwt.claims','{"session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select pg_temp.assert_true(not public.recent_account_sign_in(),'older session cannot borrow new login');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select pg_temp.assert_true(not public.recent_account_sign_in(),'another owners session denied');
reset role;
select public.queue_account_deletion('11111111-1111-4111-8111-111111111111');
do $$begin
 begin perform public.finish_account_deletion('11111111-1111-4111-8111-111111111111');raise exception 'FAILED: premature finish';exception when invalid_parameter_value then null;end;
end$$;
set role anon;
do $$begin
 begin perform public.recent_account_sign_in();raise exception 'FAILED: anonymous recent session check';exception when insufficient_privilege then null;end;
 begin perform public.deletion_objects('11111111-1111-4111-8111-111111111111');raise exception 'FAILED: anonymous object listing';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
\echo 'Deletion recent-session and authorization checks passed.'
