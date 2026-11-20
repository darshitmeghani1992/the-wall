\set ON_ERROR_STOP on
-- Source-ordered 0034 defaults to disabled. Regression verifies that even an
-- authenticated actor using the canonical RPC cannot bypass the client UI gate.
do $$
begin
  if (select enabled from public.secret_mark_rollout where singleton) then
    raise exception 'SECRET_ROLLOUT: default must be disabled';
  end if;
  if has_table_privilege('anon','public.secret_mark_rollout','UPDATE')
     or has_table_privilege('authenticated','public.secret_mark_rollout','UPDATE')
     or has_table_privilege('authenticated','public.secret_mark_rollout','SELECT') then
    raise exception 'SECRET_ROLLOUT: client can modify/read privileged flag';
  end if;
  if not has_table_privilege('service_role','public.secret_mark_rollout','UPDATE') then
    raise exception 'SECRET_ROLLOUT: service role lacks approved operator path';
  end if;
end $$;

begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare did_deny boolean:=false; v_result jsonb;
begin
  v_result := public.create_mark('62400000-0000-4000-8000-000000000002',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text'::public.mark_type,
      'normal text','#ffe14d',false,false,0,'{}'::uuid[]);
  if v_result->>'status'<>'created' then
    raise exception 'SECRET_ROLLOUT: ordinary text Mark unavailable: %', v_result;
  end if;
  begin
    perform public.create_mark('62400000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text'::public.mark_type,
      'server gate','#ffe14d',false,true,0,'{}'::uuid[]);
  exception when insufficient_privilege then
    did_deny:=true;
  end;
  if not did_deny then
    raise exception 'SECRET_ROLLOUT: authenticated RPC bypassed disabled gate';
  end if;
end $$;
rollback;
-- The harness then enables the isolated fixture for existing one-time reveal
-- and expiry regression tests. Production/staging must remain disabled unless
-- separate scheduler proof and explicit DevOps release authorization exist.
