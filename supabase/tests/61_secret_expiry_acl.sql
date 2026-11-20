\\set ON_ERROR_STOP on

-- Scheduler-only SECURITY DEFINER routine may never be user-invocable.
do $$
begin
  if has_function_privilege('anon','public.expire_secret_marks()','EXECUTE') then
    raise exception 'SEC-SECRET-EXPIRY: anon can execute scheduler cleanup';
  end if;
  if has_function_privilege('authenticated','public.expire_secret_marks()','EXECUTE') then
    raise exception 'SEC-SECRET-EXPIRY: authenticated can execute scheduler cleanup';
  end if;
  if not has_function_privilege('service_role','public.expire_secret_marks()','EXECUTE') then
    raise exception 'SEC-SECRET-EXPIRY: service role lacks intended scheduler permission';
  end if;
end $$;
