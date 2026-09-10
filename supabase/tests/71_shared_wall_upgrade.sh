#!/usr/bin/env bash
# Applies 0001–0025 to a fresh database, plants legacy owner/role drift, then
# proves 0026 reconciles it before validating the deferred invariant.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
ADMIN_DB="${ADMIN_DB:-postgres}"
BASE_TEST_DB="${TEST_DB:-sec001_test}"
UPGRADE_DB="${BASE_TEST_DB}_shared_upgrade"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$HERE/../migrations"

admin() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -q "$@"; }
testdb() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$UPGRADE_DB" -v ON_ERROR_STOP=1 -q "$@"; }
cleanup() { admin -c "DROP DATABASE IF EXISTS $UPGRADE_DB WITH (FORCE);" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
admin -c "CREATE DATABASE $UPGRADE_DB;" >/dev/null
testdb -f "$HERE/00_bootstrap.sql" >/dev/null

for migration in "$MIG"/*.sql; do
  number="$(basename "$migration" | cut -d_ -f1)"
  if [ "$number" -gt 25 ]; then break; fi
  if [ "$number" -eq 24 ]; then
    testdb -c "update media_legacy_reconciliation set state='complete',completed_at=clock_timestamp() where singleton;" >/dev/null
  fi
  testdb -f "$migration" >/dev/null
done

testdb <<'SQL' >/dev/null
insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000101','upgrade-owner@test'),
 ('71000000-0000-4000-8000-000000000102','upgrade-member@test'),
 ('71000000-0000-4000-8000-000000000104','upgrade-inactive@test'),
 ('71000000-0000-4000-8000-000000000105','upgrade-blocked@test'),
 ('71000000-0000-4000-8000-000000000106','upgrade-pending@test');
insert into profiles(id,handle,display_name) values
 ('71000000-0000-4000-8000-000000000101','upgrade_owner','Upgrade Owner'),
 ('71000000-0000-4000-8000-000000000102','upgrade_member','Upgrade Member'),
 ('71000000-0000-4000-8000-000000000104','upgrade_inactive','Upgrade Inactive'),
 ('71000000-0000-4000-8000-000000000105','upgrade_blocked','Upgrade Blocked'),
 ('71000000-0000-4000-8000-000000000106','upgrade_pending','Upgrade Pending');
insert into walls(id,owner_id,type,name,visibility)
 values('71000000-0000-4000-8000-000000000103',
        '71000000-0000-4000-8000-000000000101','shared','Upgrade Wall','private');
insert into wall_members(wall_id,user_id,role,status) values
 ('71000000-0000-4000-8000-000000000103',
  '71000000-0000-4000-8000-000000000101','member','accepted'),
 ('71000000-0000-4000-8000-000000000103',
  '71000000-0000-4000-8000-000000000102','owner','accepted'),
 ('71000000-0000-4000-8000-000000000103',
  '71000000-0000-4000-8000-000000000104','owner','accepted'),
 ('71000000-0000-4000-8000-000000000103',
  '71000000-0000-4000-8000-000000000105','owner','accepted'),
 ('71000000-0000-4000-8000-000000000103',
  '71000000-0000-4000-8000-000000000106','member','pending');
update profiles set account_status='deactivated',deactivated_at=now()
 where id='71000000-0000-4000-8000-000000000104';
insert into blocks(blocker_id,blocked_id) values
 ('71000000-0000-4000-8000-000000000101',
  '71000000-0000-4000-8000-000000000105');

-- A prior partial rollout may have created the private ledger before completing
-- owner reconciliation. 0026 must safely remove that impossible tombstone too.
create table shared_wall_member_removals (
 wall_id uuid not null references walls(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 removed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(wall_id,user_id)
);
insert into shared_wall_member_removals(wall_id,user_id,removed_by)
 values('71000000-0000-4000-8000-000000000103',
        '71000000-0000-4000-8000-000000000101',null),
       ('71000000-0000-4000-8000-000000000103',
        '71000000-0000-4000-8000-000000000102',
        '71000000-0000-4000-8000-000000000101'),
       ('71000000-0000-4000-8000-000000000103',
        '71000000-0000-4000-8000-000000000106',
        '71000000-0000-4000-8000-000000000101');
SQL

testdb -f "$MIG/0026_shared_wall_lifecycle.sql" >/dev/null
testdb <<'SQL'
do $$ begin
  if exists(select 1 from wall_members
             where wall_id='71000000-0000-4000-8000-000000000103'
               and user_id='71000000-0000-4000-8000-000000000101') then
    raise exception '71 UPGRADE FAIL: owner membership survived reconciliation';
  end if;
  if exists(select 1 from shared_wall_member_removals
             where wall_id='71000000-0000-4000-8000-000000000103'
               and user_id in ('71000000-0000-4000-8000-000000000101',
                               '71000000-0000-4000-8000-000000000102')) then
    raise exception '71 UPGRADE FAIL: owner/accepted tombstone survived reconciliation';
  end if;
  if (select count(*) from wall_members
       where wall_id='71000000-0000-4000-8000-000000000103'
         and user_id in ('71000000-0000-4000-8000-000000000102',
                         '71000000-0000-4000-8000-000000000104',
                         '71000000-0000-4000-8000-000000000105')
         and role='member' and status='accepted')<>3 then
    raise exception '71 UPGRADE FAIL: active/inactive/blocked legacy roles not canonicalized';
  end if;
  if not exists(select 1 from wall_members wm
                 join shared_wall_member_removals r
                   on r.wall_id=wm.wall_id and r.user_id=wm.user_id
                 where wm.wall_id='71000000-0000-4000-8000-000000000103'
                   and wm.user_id='71000000-0000-4000-8000-000000000106'
                   and wm.status='pending') then
    raise exception '71 UPGRADE FAIL: pending+tombstone state was not preserved';
  end if;
  if not exists(select 1 from pg_trigger
                 where tgrelid='public.wall_members'::regclass
                   and tgname='aa_wall_members_pair_guard' and tgenabled='O')
     or not exists(select 1 from pg_trigger
                    where tgrelid='public.wall_members'::regclass
                      and tgname='wall_members_transition' and tgenabled='O') then
    raise exception '71 UPGRADE FAIL: runtime membership guards not rebuilt';
  end if;
end $$;
SQL
echo "71 upgrade reconciliation          : PASS"
