-- Staging-only, transaction-rolled-back PostgreSQL RLS smoke.
-- Source contract: migrations 0001–0030 + optional 0032 least-privilege fix.
-- NEVER apply as a migration, never run on the original user-data project.
-- Requires a connected Postgres role allowed to SET ROLE authenticated.
-- Tests synthetic fake accounts, no emails, no persistent data or Auth delivery.
BEGIN;

INSERT INTO auth.users(id,email) VALUES
('11111111-1111-4111-8111-111111111111','smoke-owner@example.invalid'),
('22222222-2222-4222-8222-222222222222','smoke-friend@example.invalid'),
('33333333-3333-4333-8333-333333333333','smoke-stranger@example.invalid');
INSERT INTO public.profiles(id,handle,display_name) VALUES
('11111111-1111-4111-8111-111111111111','smoke-owner','Smoke Owner'),
('22222222-2222-4222-8222-222222222222','smoke-friend','Smoke Friend'),
('33333333-3333-4333-8333-333333333333','smoke-stranger','Smoke Stranger');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.walls WHERE type='personal' AND owner_id IN
    ('11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '33333333-3333-4333-8333-333333333333')) <> 3 THEN
    RAISE EXCEPTION 'SMOKE: missing personal-wall bootstrap';
  END IF;
END $$;

-- Store a real private Wall locator in a transaction-local setting BEFORE
-- impersonating the stranger; otherwise RLS would hide the Wall ID and make
-- the negative create_mark test vacuously pass on NULL input.
SELECT set_config('tw.smoke_owner_wall',
  (SELECT id::text FROM public.walls
   WHERE owner_id='11111111-1111-4111-8111-111111111111' AND type='personal'),true);
INSERT INTO public.friendships(requester_id,addressee_id,status)
VALUES('11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222','accepted');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$
DECLARE v jsonb; wid uuid:=current_setting('tw.smoke_owner_wall')::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.walls WHERE id=wid) THEN
    RAISE EXCEPTION 'SMOKE: accepted friend cannot view private personal Wall';
  END IF;
  v:=public.create_mark('44444444-4444-4444-8444-444444444444',wid,
    'text'::public.mark_type,'hello from friend','#ffe14d',false,false,0,'{}'::uuid[]);
  IF v->>'status'<>'created' THEN RAISE EXCEPTION 'SMOKE: friend text Mark rejected: %',v; END IF;
  v:=public.create_mark('44444444-4444-4444-8444-444444444444',wid,
    'text'::public.mark_type,'hello from friend','#ffe14d',false,false,0,'{}'::uuid[]);
  IF v->>'status'<>'existing' THEN RAISE EXCEPTION 'SMOKE: idempotent retry failed: %',v; END IF;
  v:=public.create_mark('66666666-6666-4666-8666-666666666666',wid,
    'text'::public.mark_type,'secret content','#ffe14d',false,true,0,'{}'::uuid[]);
  IF v->>'status'<>'created' THEN RAISE EXCEPTION 'SMOKE: Secret Mark rejected: %',v; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $$
DECLARE v jsonb; wid uuid:=current_setting('tw.smoke_owner_wall')::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.walls WHERE id=wid) THEN
    RAISE EXCEPTION 'SMOKE: stranger reads a private personal Wall';
  END IF;
  -- Use the exact real locator obtained by postgres, not a NULL SELECT.
  v:=public.create_mark('55555555-5555-4555-8555-555555555555',wid,
    'text'::public.mark_type,'unauthorized','#ffe14d',false,false,0,'{}'::uuid[]);
  IF v->>'status'<>'unavailable' THEN RAISE EXCEPTION 'SMOKE: stranger was not denied: %',v; END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.marks WHERE wall_id=current_setting('tw.smoke_owner_wall')::uuid)<>2 THEN
    RAISE EXCEPTION 'SMOKE: unexpected Mark count after idempotency/denial';
  END IF;
  IF (SELECT count(*) FROM public.marks WHERE secret AND text IS NULL AND
      wall_id=current_setting('tw.smoke_owner_wall')::uuid)<>1 THEN
    RAISE EXCEPTION 'SMOKE: Secret Mark payload exposed on public Marks row';
  END IF;
  IF (SELECT count(*) FROM public.mark_secrets)<>1 THEN
    RAISE EXCEPTION 'SMOKE: Secret Mark side payload not isolated';
  END IF;
END $$;

-- An accepted friend is now explicitly blocked by the owner. A subsequent
-- new request must fail even with the same previously legitimate Wall ID.
INSERT INTO public.blocks(blocker_id,blocked_id)
VALUES('11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$
DECLARE v jsonb; wid uuid:=current_setting('tw.smoke_owner_wall')::uuid;
BEGIN
  v:=public.create_mark('77777777-7777-4777-8777-777777777777',wid,
    'text'::public.mark_type,'blocked attempt','#ffe14d',false,false,0,'{}'::uuid[]);
  IF v->>'status'<>'unavailable' THEN RAISE EXCEPTION 'SMOKE: blocked friend wrote Mark: %',v; END IF;
END $$;
RESET ROLE;

-- No trace of fake identities or actions survives the transaction.
ROLLBACK;
SELECT (SELECT count(*) FROM auth.users) AS auth_users_after_rollback,
       (SELECT count(*) FROM public.profiles) AS profiles_after_rollback,
       (SELECT count(*) FROM public.walls) AS walls_after_rollback,
       (SELECT count(*) FROM public.marks) AS marks_after_rollback,
       (SELECT count(*) FROM storage.objects) AS storage_after_rollback;
