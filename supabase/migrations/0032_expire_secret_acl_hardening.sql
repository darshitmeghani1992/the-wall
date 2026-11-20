-- 0032 · Secret Mark expiry scheduler function: explicit service-role-only ACL.
--
-- Hosted staging postflight (20 November 2026) found that `expire_secret_marks()`, a
-- SECURITY DEFINER routine that purges *all* expired Secret Mark payloads,
-- was directly executable by authenticated clients through PostgREST.
-- This is a privilege-boundary regression despite the intended 0010
-- service-role-only contract: hosted default privileges granted EXECUTE
-- directly to authenticated, so revoking from PUBLIC was not sufficient.
--
-- No data modification. Idempotent, forward-only least-privilege correction.
-- PostgreSQL checks function EXECUTE rights even if the function is exposed by
-- PostgREST RPC. No user actor should trigger global garbage collection.
-- The service role retains access for the approved scheduler.

revoke execute on function public.expire_secret_marks() from public, anon, authenticated;
grant execute on function public.expire_secret_marks() to service_role;
