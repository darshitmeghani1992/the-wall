\set ON_ERROR_STOP on

-- BETA-P0: SECURITY DEFINER routines depend on stable trusted schemas.
-- Do not allow client roles (or PUBLIC) to CREATE in schemas used by
-- privileged routines, even if each function sets a search_path.
-- Catalog-only guard in disposable PostgreSQL; does NOT test pg_temp,
-- dynamic SQL, caller authorization, or hosted authenticated JWT behavior.
DO $trusted_schema_guard$
DECLARE
  v_schema record;
  v_client_role text;
BEGIN
  IF (SELECT count(*) FROM pg_namespace
      WHERE nspname IN ('public', 'auth', 'storage')) <> 3 THEN
    RAISE EXCEPTION '77 FAIL: missing trusted schema (public/auth/storage)';
  END IF;

  FOR v_schema IN
    SELECT oid, nspname, nspacl, nspowner
      FROM pg_namespace
     WHERE nspname IN ('public', 'auth', 'storage')
     ORDER BY nspname
  LOOP
    FOREACH v_client_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF has_schema_privilege(v_client_role, v_schema.oid, 'CREATE') THEN
        RAISE EXCEPTION '77 FAIL: % may CREATE in trusted schema %',
          v_client_role, v_schema.nspname;
      END IF;
    END LOOP;

    IF EXISTS (
      SELECT 1
        FROM aclexplode(coalesce(v_schema.nspacl,
                                 acldefault('n', v_schema.nspowner))) AS grant_entry
       WHERE grant_entry.grantee = 0
         AND grant_entry.privilege_type = 'CREATE'
    ) THEN
      RAISE EXCEPTION '77 FAIL: PUBLIC has CREATE on trusted schema %',
        v_schema.nspname;
    END IF;
  END LOOP;
END $trusted_schema_guard$;
\echo '77 (trusted schema CREATE grants for definer search paths): PASS'
