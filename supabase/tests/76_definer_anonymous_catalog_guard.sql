\set ON_ERROR_STOP on

-- BETA-P0: regression guard on publicly exposed SECURITY DEFINER grants.
-- Anonymous execution must remain denied; a fixed search_path must be
-- explicitly present. This is catalog-only disposable PostgreSQL evidence,
-- NOT a genuine HTTP JWT/RLS behavioral test or a caller-by-caller audit.
DO $definer_surface$
DECLARE
  v_direct_count integer;
  v_bad record;
BEGIN
  SELECT count(*) INTO v_direct_count
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
     AND p.prorettype <> 'pg_catalog.trigger'::regtype
     AND has_function_privilege('authenticated',p.oid,'EXECUTE');

  -- A missing migration or dropped role must not make the grant checks
  -- vacuously pass on an empty catalogue.
  IF v_direct_count < 20 THEN
    RAISE EXCEPTION '76 FAIL: expected existing direct authenticated DEFINER surface; observed %',v_direct_count;
  END IF;

  FOR v_bad IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
       AND has_function_privilege('anon',p.oid,'EXECUTE')
  LOOP
    RAISE EXCEPTION '76 FAIL: anonymous EXECUTE on SECURITY DEFINER %',v_bad.signature;
  END LOOP;

  FOR v_bad IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1 FROM unnest(p.proconfig) setting
          WHERE setting LIKE 'search_path=%'
       )
  LOOP
    RAISE EXCEPTION '76 FAIL: missing fixed search_path on SECURITY DEFINER %',v_bad.signature;
  END LOOP;
END $definer_surface$;
\echo '76 (global SECURITY DEFINER anon grant + search_path catalog guard): PASS'
