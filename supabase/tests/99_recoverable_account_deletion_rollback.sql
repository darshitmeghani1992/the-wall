\set ON_ERROR_STOP on

do $$ begin
  if to_regclass('public.account_deletion_requests') is not null
     or to_regprocedure('public.request_account_deletion(uuid,text)') is not null
     or to_regprocedure('public.get_my_account_deletion()') is not null
     or to_regprocedure('public.list_due_account_deletions(integer)') is not null
     or to_regprocedure('public.prepare_account_deletion_for_purge(uuid,timestamptz)') is not null then
    raise exception '99 ROLLBACK FAIL: 0031 surfaces remain';
  end if;
  if not has_function_privilege(
      'authenticated','public.reactivate_account(uuid)','execute') then
    raise exception '99 ROLLBACK FAIL: actor-bound reactivation was not restored';
  end if;
end $$;

begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
select public.reactivate_account('11111111-1111-1111-1111-111111111111');
rollback;

\echo '99 (0031 pre-apply rollback)         : PASS'
