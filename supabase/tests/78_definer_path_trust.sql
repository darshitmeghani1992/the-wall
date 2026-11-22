\set ON_ERROR_STOP on

-- All public SECURITY DEFINER routines execute with elevated rights.
-- Fail if a new routine resolves untrusted schemas or is owned by a client
-- role. This is a disposable catalog regression, not behavioral JWT QA.
DO $definer_path_trust$
DECLARE
  v_func record;
  v_path text;
  v_schema_name text;
  v_namespace oid;
  v_count integer := 0;
BEGIN
  FOR v_func IN
    SELECT p.oid, p.oid::regprocedure AS signature, p.proconfig,
           pg_get_userbyid(p.proowner) AS owner_name
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    v_count := v_count + 1;

    IF v_func.owner_name IN ('anon', 'authenticated', 'authenticator') THEN
      RAISE EXCEPTION '78 FAIL: client role owns SECURITY DEFINER %', v_func.signature;
    END IF;

    SELECT split_part(setting, '=', 2)
      INTO v_path
      FROM unnest(v_func.proconfig) AS setting
     WHERE setting LIKE 'search_path=%'
     LIMIT 1;

    IF v_path IS NULL OR btrim(v_path) = '' THEN
      RAISE EXCEPTION '78 FAIL: no explicit search_path for %', v_func.signature;
    END IF;

    FOR v_schema_name IN
      SELECT btrim(btrim(part), '"')
        FROM unnest(string_to_array(v_path, ',')) AS part
    LOOP
      -- A new schema needs deliberate security review. An attacker-writable
      -- schema (or $user/pg_temp) must never silently enter this path.
      IF v_schema_name NOT IN
        ('pg_catalog', 'public', 'auth', 'storage', 'extensions') THEN
        RAISE EXCEPTION '78 FAIL: unexpected schema % in % search_path',
          v_schema_name, v_func.signature;
      END IF;

      SELECT oid INTO v_namespace
        FROM pg_namespace WHERE nspname = v_schema_name;

      IF v_namespace IS NULL THEN
        RAISE EXCEPTION '78 FAIL: search_path schema % absent for %',
          v_schema_name, v_func.signature;
      END IF;

      IF has_schema_privilege('anon', v_namespace, 'CREATE')
         OR has_schema_privilege('authenticated', v_namespace, 'CREATE')
         OR EXISTS (
           SELECT 1 FROM pg_namespace n,
             LATERAL aclexplode(coalesce(n.nspacl,
                                          acldefault('n', n.nspowner))) acl
            WHERE n.oid = v_namespace
              AND acl.grantee = 0
              AND acl.privilege_type = 'CREATE'
         ) THEN
        RAISE EXCEPTION '78 FAIL: untrusted CREATE on % in % search_path',
          v_schema_name, v_func.signature;
      END IF;
    END LOOP;
  END LOOP;

  IF v_count < 80 THEN
    RAISE EXCEPTION '78 FAIL: expected existing SECURITY DEFINER catalogue, saw %', v_count;
  END IF;
END $definer_path_trust$;
\echo '78 (SECURITY DEFINER owner and complete trusted search_path): PASS'
