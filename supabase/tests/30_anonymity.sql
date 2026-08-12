-- ════════════════════════════════════════════════════════════════════════════
-- 30_anonymity.sql · AC-S6  (F4, G-A)
--
-- One transaction: A posts an anonymous mark (sending the true author_id, to
-- prove the server nulls it), then we assert — as the acting roles — that:
--   • the base row carries author_id = NULL              (REST read path)
--   • the row a realtime postgres_changes stream would emit carries NULL
--   • an ordinary authenticated reader sees author_id = NULL
--   • an ordinary authenticated reader CANNOT read the side table (permission)
--   • service_role (moderation path) CAN read the true author from the side table
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

BEGIN;

-- A posts an anonymous mark, explicitly sending its own id as author_id.
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-cccccccccc06',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','secret','anonymous secret', true);

-- Base row: author_id nulled at the write boundary.
do $$
begin
  if (select author_id from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc06') is not null then
    raise exception 'AC-S6 FAIL: base row author_id was not nulled';
  end if;
end $$;
\echo 'AC-S6 (base row author_id NULL)    : PASS  (REST read path is clean)'

-- Simulated realtime payload: postgres_changes streams exactly the base row.
do $$
declare payload record;
begin
  select id, wall_id, author_id, anonymous
    into payload from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc06';
  if payload.author_id is not null then
    raise exception 'AC-S6 FAIL: realtime INSERT payload would leak author_id';
  end if;
end $$;
\echo 'AC-S6 (realtime payload author NULL): PASS  (streamed row carries NULL)'

-- Ordinary authenticated reader (B) sees no author, and cannot read side table.
reset role;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (ordinary user)
do $$
begin
  if (select author_id from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc06') is not null then
    raise exception 'AC-S6 FAIL: ordinary reader obtained author_id via marks';
  end if;
end $$;
do $$
declare denied boolean := false;
begin
  begin
    perform 1 from anonymous_mark_authors where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc06';
  exception when others then denied := true;  -- revoked from authenticated → permission denied
  end;
  if not denied then raise exception 'AC-S6 FAIL: ordinary user read the moderator-only side table'; end if;
end $$;
\echo 'AC-S6 (ordinary user cannot de-anon): PASS  (marks NULL + side table denied)'

-- Positive moderator assertion: service_role reads the true author.
reset role;
set local role service_role;
set local "test.uid" = '';
do $$
begin
  if (select author_id from anonymous_mark_authors
        where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc06')
     is distinct from '11111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'AC-S6 FAIL: moderation path could not read the true author';
  end if;
end $$;
\echo 'AC-S6 (moderator reads true author): PASS  (service_role via explicit grant)'

ROLLBACK;

\echo '── 30_anonymity: ALL PASS (AC-S6 + moderator-read) ──'
