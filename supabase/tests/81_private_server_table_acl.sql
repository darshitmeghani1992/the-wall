\set ON_ERROR_STOP on

-- BETA-P0: private identity, Secret and media service-side storage is never
-- directly exposed through PostgREST to anon/authenticated table CRUD.
-- Fail on a new client ACL, policy, or missing RLS. Service-only RPCs/workers
-- remain unchanged. Disposable PostgreSQL catalog proof, NOT JWT/HTTP QA.
DO $private_server_storage$
DECLARE
  v_name text;
  v_oid oid;
  v_rls boolean;
  v_kind "char";
  v_role text;
  v_privilege text;
  v_checked integer := 0;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'anonymous_mark_authors',
    'notification_origins',
    'mark_secrets',
    'shared_wall_member_removals',
    'mark_media',
    'media_uploads',
    'media_envelope_keys',
    'media_signing_rate_limits'
  ] LOOP
    SELECT c.oid, c.relrowsecurity, c.relkind
      INTO v_oid, v_rls, v_kind
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_name;

    IF v_oid IS NULL OR v_kind NOT IN ('r', 'p') THEN
      RAISE EXCEPTION '81 FAIL: protected server table public.% missing', v_name;
    END IF;
    v_checked := v_checked + 1;

    IF NOT v_rls THEN
      RAISE EXCEPTION '81 FAIL: RLS missing from protected table public.%', v_name;
    END IF;

    -- Existing sensitive tables deliberately have no client RLS policy. An
    -- intentional future access change needs explicit architecture/security
    -- review, not an accidental broadly-permissive new policy.
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = v_oid) THEN
      RAISE EXCEPTION '81 FAIL: client policy added to protected table public.%', v_name;
    END IF;

    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
        IF has_table_privilege(v_role, v_oid, v_privilege) THEN
          RAISE EXCEPTION '81 FAIL: client role % has % on protected table public.%',
            v_role, v_privilege, v_name;
        END IF;

        -- PostgreSQL permits SELECT/INSERT/UPDATE grants on individual columns
        -- without granting the table-wide privilege. A table ACL-only check
        -- would miss that direct PostgREST access path; DELETE has no
        -- column-level privilege and is covered by has_table_privilege above.
        IF v_privilege IN ('SELECT', 'INSERT', 'UPDATE')
           AND has_any_column_privilege(v_role, v_oid, v_privilege) THEN
          RAISE EXCEPTION '81 FAIL: client role % has % on a column of protected table public.%',
            v_role, v_privilege, v_name;
        END IF;
      END LOOP;

      -- All protected tables except mark_secrets currently deny ancillary
      -- table privileges too. Keep the observed mark_secrets exception explicit
      -- until its separate security/schema approval (issue #186); never imply
      -- that SQL grants are equivalent to a public PostgREST attack surface.
      IF v_name <> 'mark_secrets' THEN
        FOREACH v_privilege IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
          IF has_table_privilege(v_role, v_oid, v_privilege) THEN
            RAISE EXCEPTION '81 FAIL: client role % has % on service-only table public.%',
              v_role, v_privilege, v_name;
          END IF;
          -- REFERENCES may also be granted only on individual columns, even
          -- when the table-wide permission is denied (same trap as CRUD).
          IF v_privilege = 'REFERENCES'
             AND has_any_column_privilege(v_role, v_oid, 'REFERENCES') THEN
            RAISE EXCEPTION '81 FAIL: client role % has column REFERENCES on service-only table public.%',
              v_role, v_name;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    -- Positive server-worker contract and deliberately narrower postgres-only
    -- internals. The media key registry and removal-history side table are
    -- accessed via reviewed SECURITY DEFINER functions, not direct service
    -- table privileges. The other six tables are intended for service worker
    -- CRUD in migrations; silently losing those grants would break cleanup,
    -- moderation, notifications or media processing even if RLS still passes.
    FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF v_name IN ('media_envelope_keys', 'shared_wall_member_removals') THEN
        IF has_table_privilege('service_role', v_oid, v_privilege)
           OR (v_privilege IN ('SELECT', 'INSERT', 'UPDATE')
               AND has_any_column_privilege('service_role', v_oid, v_privilege)) THEN
          RAISE EXCEPTION '81 FAIL: service_role has unintended direct % on definer-only public.%',
            v_privilege, v_name;
        END IF;
      ELSIF NOT has_table_privilege('service_role', v_oid, v_privilege) THEN
        RAISE EXCEPTION '81 FAIL: service_role missing required % on worker table public.%',
          v_privilege, v_name;
      END IF;
    END LOOP;
  END LOOP;

  IF v_checked <> 8 THEN
    RAISE EXCEPTION '81 FAIL: incomplete protected-table catalogue: %', v_checked;
  END IF;
END $private_server_storage$;

\echo '81 (private table client denies and service worker contract): PASS'
