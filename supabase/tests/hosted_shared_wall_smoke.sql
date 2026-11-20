-- Staging-only rollback smoke for the shared-wall actor-bound lifecycle.
-- Never run on the original The Wall user-data project.
-- No persistent accounts, emails, marks, or walls: BEGIN ... ROLLBACK.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('a1111111-1111-4111-8111-111111111111','shared-owner@example.invalid'),
 ('b2222222-2222-4222-8222-222222222222','shared-member@example.invalid'),
 ('c3333333-3333-4333-8333-333333333333','shared-outsider@example.invalid');
INSERT INTO public.profiles(id,handle,display_name) VALUES
 ('a1111111-1111-4111-8111-111111111111','shared-owner','Owner'),
 ('b2222222-2222-4222-8222-222222222222','shared-member','Member'),
 ('c3333333-3333-4333-8333-333333333333','shared-outsider','Outsider');

-- A real authenticated user, not the privileged setup role, creates the Wall.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE wid uuid; result jsonb; BEGIN
  INSERT INTO public.walls(owner_id,type,name,visibility,contribution_policy,allow_anonymous,require_approval,open_join)
  VALUES(auth.uid(),'shared','Smoke Private Shared','private','nobody',false,false,false)
  RETURNING id INTO wid;
  IF wid IS NULL THEN RAISE EXCEPTION 'SHARED_SMOKE: owner create failed'; END IF;
  PERFORM set_config('tw.smoke_shared_wall',wid::text,true);
  result := public.invite_shared_wall_member(wid,'b2222222-2222-4222-8222-222222222222');
  IF result->>'status'<>'invited' THEN RAISE EXCEPTION 'SHARED_SMOKE: invite failed %',result; END IF;
END $$;

-- Before acceptance, invitee sees only a minimal actor-bound invite preview,
-- not the private Wall row itself.
SELECT set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
DO $$ DECLARE wid uuid:=current_setting('tw.smoke_shared_wall')::uuid; result jsonb; BEGIN
  IF EXISTS(SELECT 1 FROM public.walls WHERE id=wid) THEN
    RAISE EXCEPTION 'SHARED_SMOKE: pending invite leaked private Wall';
  END IF;
  result:=public.get_my_pending_shared_wall_invite(wid);
  IF result->>'status'<>'available' THEN
    RAISE EXCEPTION 'SHARED_SMOKE: authorized invite preview unavailable: %',result;
  END IF;
  result:=public.respond_shared_wall_invite(wid,true);
  IF result->>'status'<>'accepted' THEN RAISE EXCEPTION 'SHARED_SMOKE: accept failed %',result; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.walls WHERE id=wid) THEN
    RAISE EXCEPTION 'SHARED_SMOKE: accepted member cannot view private Wall';
  END IF;
  result:=public.create_mark('d4444444-4444-4444-8444-444444444444',wid,
   'text'::public.mark_type,'member mark','#ffe14d',false,false,0,'{}'::uuid[]);
  IF result->>'status'<>'created' THEN
    RAISE EXCEPTION 'SHARED_SMOKE: accepted member cannot contribute: %',result;
  END IF;
END $$;

-- Outsider has exact real Wall UUID but cannot view, join or post.
SELECT set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
DO $$ DECLARE wid uuid:=current_setting('tw.smoke_shared_wall')::uuid; result jsonb; BEGIN
  IF EXISTS(SELECT 1 FROM public.walls WHERE id=wid) THEN
    RAISE EXCEPTION 'SHARED_SMOKE: unrelated actor views private Wall';
  END IF;
  result:=public.create_mark('e5555555-5555-4555-8555-555555555555',wid,
   'text'::public.mark_type,'forbidden','#ffe14d',false,false,0,'{}'::uuid[]);
  IF result->>'status'<>'unavailable' THEN RAISE EXCEPTION 'SHARED_SMOKE: outsider Mark write %',result; END IF;
  result:=public.join_shared_wall(wid);
  IF result->>'status'<>'unavailable' THEN RAISE EXCEPTION 'SHARED_SMOKE: private join bypass %',result; END IF;
END $$;

-- Owner can remove the member; that revokes their private read and write.
SELECT set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE wid uuid:=current_setting('tw.smoke_shared_wall')::uuid; result jsonb; BEGIN
  result:=public.remove_shared_wall_member(wid,'b2222222-2222-4222-8222-222222222222');
  IF result->>'status'<>'removed' THEN RAISE EXCEPTION 'SHARED_SMOKE: removal failed %',result; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
DO $$ DECLARE wid uuid:=current_setting('tw.smoke_shared_wall')::uuid; result jsonb; BEGIN
  IF EXISTS(SELECT 1 FROM public.walls WHERE id=wid) THEN
    RAISE EXCEPTION 'SHARED_SMOKE: removed member can still view private Wall';
  END IF;
  result:=public.create_mark('f6666666-6666-4666-8666-666666666666',wid,
   'text'::public.mark_type,'removed actor attempt','#ffe14d',false,false,0,'{}'::uuid[]);
  IF result->>'status'<>'unavailable' THEN RAISE EXCEPTION 'SHARED_SMOKE: removed member wrote Mark %',result; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT (SELECT count(*) FROM auth.users) AS users_after_rollback,
       (SELECT count(*) FROM public.profiles) AS profiles_after_rollback,
       (SELECT count(*) FROM public.walls) AS walls_after_rollback,
       (SELECT count(*) FROM public.marks) AS marks_after_rollback,
       (SELECT count(*) FROM storage.objects) AS storage_after_rollback;
