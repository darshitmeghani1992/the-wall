\set ON_ERROR_STOP on
do $$
begin
  if to_regprocedure('public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)') is not null then
    raise exception '87 FAIL: preapply rollback retained Poll purge wrapper';
  end if;
  if to_regprocedure('public.prepare_account_deletion_for_purge(uuid,timestamptz)') is null then
    raise exception '87 FAIL: preapply rollback altered original 0031 routine';
  end if;
end $$;
\echo '87 (Poll purge wrapper preapply rollback): PASS'
