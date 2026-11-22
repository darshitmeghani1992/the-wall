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
      END LOOP;
    END LOOP;
  END LOOP;

  IF v_checked <> 8 THEN
    RAISE EXCEPTION '81 FAIL: incomplete protected-table catalogue: %', v_checked;
  END IF;
END $private_server_storage$;

\echo '81 (server-only sensitive table RLS, policy and CRUD ACL): PASS'
