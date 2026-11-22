\set ON_ERROR_STOP on

-- BETA-P0: registry/attachment contract for security-sensitive trigger code.
-- A function existing with SECURITY DEFINER is not enough: a renamed, disabled,
-- detached or miswired trigger can bypass a privacy/safety guard without touching
-- the function body. Disposable PostgreSQL catalog assertion; NOT hosted JWT QA.
DO $sensitive_trigger_contract$
DECLARE
  v_count integer;
  v_bad record;
  v_expected record;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prokind = 'f' AND p.prosecdef
     AND p.prorettype = 'pg_catalog.trigger'::regtype;
  IF v_count < 30 THEN
    RAISE EXCEPTION '79 FAIL: expected established SECURITY DEFINER trigger catalogue; saw %', v_count;
  END IF;

  -- Every privileged trigger routine must still be attached to at least one
  -- non-internal, enabled trigger on an actual table.
  FOR v_bad IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.prokind = 'f' AND p.prosecdef
       AND p.prorettype = 'pg_catalog.trigger'::regtype
       AND NOT EXISTS (
         SELECT 1 FROM pg_trigger t
          WHERE t.tgfoid = p.oid AND NOT t.tgisinternal
            AND t.tgenabled IN ('O', 'A')
       )
  LOOP
    RAISE EXCEPTION '79 FAIL: orphaned/disabled privileged trigger function %', v_bad.signature;
  END LOOP;

  -- Protect a small, explicit, high-impact subset of wiring (not a blanket
  -- snapshot of all trigger names). Events/stages are checked, not just names.
  FOR v_expected IN
    SELECT * FROM (VALUES
      ('marks', 'a00_secret_mark_expiry_gate', 'enforce_secret_mark_expiry_gate', 'INSERT', true),
      ('marks', 'a0_marks_pair_guard', 'guard_mark_contribution_pair', 'INSERT', true),
      ('marks', 'marks_null_anon', 'marks_null_anonymous_author', 'INSERT', true),
      ('marks', 'marks_record_anon', 'marks_record_anonymous_author', 'INSERT', false),
      ('marks', 'zz_marks_notify', 'notify_mark_left', 'INSERT', false),
      ('marks', 'a0_mark_creation_deleted_tombstone', 'mark_creation_deleted_tombstone', 'DELETE', true),
      ('walls', 'aa_shared_wall_create_guard', 'guard_shared_wall_create', 'INSERT', true),
      ('mark_reactions', 'aa_reactions_pair_guard', 'guard_reaction_pair_write', 'INSERT', true),
      ('mark_reactions', 'mark_reactions_notify', 'notify_reaction', 'INSERT', false),
      ('wall_members', 'aa_wall_members_pair_guard', 'guard_wall_member_pair_write', 'INSERT', true),
      ('wall_members', 'wall_members_notify', 'notify_wall_invite', 'INSERT', false),
      ('mark_media', 'mark_media_integrity', 'guard_mark_media_integrity', 'INSERT', true),
      ('mark_media', 'a0_mark_media_deletion_outbox', 'enqueue_mark_media_deletion', 'DELETE', true)
    ) AS e(table_name, trigger_name, function_name, event_name, is_before)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE t.tgrelid = to_regclass('public.' || v_expected.table_name)
         AND t.tgname = v_expected.trigger_name
         AND NOT t.tgisinternal AND t.tgenabled IN ('O', 'A')
         AND p.pronamespace = 'public'::regnamespace
         AND p.proname = v_expected.function_name AND p.prosecdef
         AND (t.tgtype::integer & 1) <> 0 -- row trigger
         AND ((t.tgtype::integer & 2) <> 0) = v_expected.is_before
         AND (t.tgtype::integer & CASE v_expected.event_name
                 WHEN 'INSERT' THEN 4 WHEN 'DELETE' THEN 8 ELSE 0 END) <> 0
    ) THEN
      RAISE EXCEPTION '79 FAIL: missing/disabled/miswired %.% -> % (%)',
        v_expected.table_name, v_expected.trigger_name,
        v_expected.function_name, v_expected.event_name;
    END IF;
  END LOOP;

  -- PostgreSQL fires same-event triggers alphabetically by name. Anonymous
  -- author attribution must precede the notification AFTER INSERT trigger;
  -- the latter must never learn the public actor from the side-table lookup.
  IF (SELECT t.tgname FROM pg_trigger t
         JOIN pg_proc p ON p.oid=t.tgfoid
        WHERE t.tgrelid='public.marks'::regclass
          AND p.proname='marks_record_anonymous_author'
          AND p.pronamespace='public'::regnamespace
          AND t.tgenabled IN ('O','A')
        LIMIT 1)
     >= (SELECT t.tgname FROM pg_trigger t
           JOIN pg_proc p ON p.oid=t.tgfoid
          WHERE t.tgrelid='public.marks'::regclass
            AND p.proname='notify_mark_left'
            AND p.pronamespace='public'::regnamespace
            AND t.tgenabled IN ('O','A')
          LIMIT 1) THEN
    RAISE EXCEPTION '79 FAIL: anonymous author attribution must precede Mark notification';
  END IF;
END $sensitive_trigger_contract$;

\echo '79 (sensitive SECURITY DEFINER trigger binding and ordering): PASS'
