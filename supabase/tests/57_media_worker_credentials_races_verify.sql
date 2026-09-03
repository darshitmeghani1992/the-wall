\set ON_ERROR_STOP on
do $$ declare c media57_claims%rowtype; r jsonb; begin
  if not exists(select 1 from media57_race_results where name='bind_before_rotate' and value)
     or not exists(select 1 from media57_race_results where name='rotate_after_bind' and value)
     or not exists(select 1 from media57_race_results where name='bind_after_rotate' and not value)
     or not exists(select 1 from media57_race_results where name='redeem_before_revoke' and value)
     or not exists(select 1 from media57_race_results where name='revoke_after_redeem' and value)
     or not exists(select 1 from media57_race_results where name='finalize_before_revoke' and value)
     or not exists(select 1 from media57_race_results where name='revoke_after_finalize' and value)
     or not exists(select 1 from media57_race_results where name='dispatch_expired_while_waiting' and not value)
     or not exists(select 1 from media57_race_results where name='finalize_expired_while_waiting' and not value) then
    raise exception '57 RACE FAIL: bind/rotate/redeem/finalize linearization result'; end if;
  if not exists(select 1 from media_envelope_keys where kid='race-a' and status='retiring'
       and last_dispatch_exp is not null and last_completion_exp is not null)
     or not exists(select 1 from media_envelope_keys where kid in ('race-b','race-c') and status='revoked') then
    raise exception '57 RACE FAIL: key lifecycle/deadline durability'; end if;
  select * into strict c from media57_claims where slot=3;
  r:=jsonb_build_object('detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('e',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',c.validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60);
  if not finalize_media_validation_attempt(c.upload_id,c.attempt_id,'race-final-complete','race-c','success',r)
     or finalize_media_validation_attempt(c.upload_id,c.attempt_id,'race-final-complete','race-c','failed',
       jsonb_build_object('error_code','PROCESSING_FAILED')) then
    raise exception '57 RACE FAIL: post-revoke receipt retry boundary'; end if;
  if exists(select 1 from media_validation_callback_receipts r
      join media57_claims c on c.upload_id=r.upload_id and c.attempt_id=r.attempt_id
      where c.slot=5) then
    raise exception '57 RACE FAIL: expiry-crossing callback created receipt'; end if;
  if not exists(select 1 from media57_race_times t
      join media57_claims c on c.slot=4
      join media_uploads u on u.id=c.upload_id
      where t.name='dispatch_expired_while_waiting'
        and t.started_at<u.dispatch_envelope_expires_at)
     or not exists(select 1 from media57_race_times t
      join media57_claims c on c.slot=5
      join media_uploads u on u.id=c.upload_id
      where t.name='finalize_expired_while_waiting'
        and t.started_at<u.lease_expires_at) then
    raise exception '57 RACE FAIL: expiry target did not begin before deadline'; end if;
end $$;
\echo '57 (physical key/attempt races)      : PASS'

drop table media57_claims;
drop function media57_wait_ready(bigint);
drop table media57_race_ready;
drop table media57_race_times;
drop table media57_race_results;
