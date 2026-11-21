\set ON_ERROR_STOP on

-- Regression for actor-bound Wall/member SECURITY DEFINER grant surface.
-- Staging evidence is read-only; tests run only against disposable DB.
DO $$
DECLARE f record; sig text;
BEGIN
  FOR f IN
    SELECT p.oid,p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND (p.proname ILIKE '%wall%' OR p.proname ILIKE '%member%')
      AND pg_get_function_result(p.oid)<>'trigger'
  LOOP
    IF has_function_privilege('anon',f.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'WALL_DEFINER_ANON_EXEC: %',f.proname;
    END IF;
  END LOOP;
  FOREACH sig IN ARRAY ARRAY[
    'public.can_view_wall(uuid,uuid)',
    'public.is_wall_member(uuid,uuid)',
    'public.lock_shared_wall_member_rows(uuid,uuid[])'
  ]
  LOOP
    IF to_regprocedure(sig) IS NULL THEN
      RAISE EXCEPTION 'WALL_INTERNAL_MISSING: %',sig;
    END IF;
    IF has_function_privilege('authenticated',sig,'EXECUTE') THEN
      RAISE EXCEPTION 'WALL_INTERNAL_CALLABLE: %',sig;
    END IF;
  END LOOP;
  FOREACH sig IN ARRAY ARRAY[
    'public.delete_shared_wall(uuid,text)',
    'public.invite_shared_wall_member(uuid,uuid)',
    'public.transfer_shared_wall_ownership(uuid,uuid)',
    'public.list_removed_shared_wall_members(uuid)'
  ]
  LOOP
    IF to_regprocedure(sig) IS NULL
       OR NOT has_function_privilege('authenticated',sig,'EXECUTE') THEN
      RAISE EXCEPTION 'WALL_APP_CONTRACT_MISSING: %',sig;
    END IF;
  END LOOP;
END $$;
