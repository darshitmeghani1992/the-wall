-- ════════════════════════════════════════════════════════════════════════════
-- 0017 · Reporting completeness (§52) + Moderation/Admin (§53)
--
-- §52 Reporting: reports may target a Mark, a user, OR a Shared Wall; a reason
-- from a fixed vocabulary + optional details; reports become real moderation
-- records with a lifecycle (open → resolved/dismissed).
--
-- §53 Admin/Moderation: a protected admin capability (never reachable by ordinary
-- users) can inspect reports, remove content, suspend an account, and resolve
-- reports — each recorded in `moderation_actions`. Admin power is gated by an
-- `is_admin` flag + `SECURITY DEFINER` RPCs; ordinary RLS never grants it.
-- Anonymous-author identity stays service_role-only (NOT exposed to in-app admins).
--
-- Additive + idempotent. Does NOT modify 0001–0016 files. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Reports: broaden targets + reason vocab + details + lifecycle (§52) ──────
alter table reports add column if not exists reported_user_id uuid references auth.users(id) on delete cascade;
alter table reports add column if not exists reported_wall_id uuid references walls(id)      on delete cascade;
alter table reports add column if not exists details    text;
alter table reports add column if not exists status     text not null default 'open';
alter table reports add column if not exists resolved_by uuid references auth.users(id);
alter table reports add column if not exists resolved_at timestamptz;

do $$ begin alter table reports add constraint reports_status_chk
  check (status in ('open','resolved','dismissed')); exception when duplicate_object then null; end $$;
do $$ begin alter table reports add constraint reports_reason_chk
  check (reason in ('harassment','hate','sexual','spam','impersonation','privacy','other'));
  exception when duplicate_object then null; end $$;
-- A report targets EXACTLY one of Mark / user / Shared Wall.
do $$ begin alter table reports add constraint reports_one_target
  check (num_nonnulls(mark_id, reported_user_id, reported_wall_id) = 1);
  exception when duplicate_object then null; end $$;

-- ── Admin role (defined before its first use in the reports policy below) ────
alter table profiles add column if not exists is_admin boolean not null default false;

create or replace function is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.is_admin);
$$;

-- ── Privilege guard: is_admin (and the lifecycle columns) are NEVER client-set ─
-- The 0001 `profiles update self` policy lets a user update their OWN row's
-- columns — which would include `is_admin`, i.e. self-promotion to admin. This
-- BEFORE-UPDATE trigger forces `is_admin`, `account_status`, and `deactivated_at`
-- back to their old values for any NON-privileged caller (current_user not
-- service_role/postgres). The lifecycle RPCs (deactivate/reactivate/admin_*) run
-- SECURITY DEFINER as the table owner, so current_user is 'postgres' there and the
-- guard lets them through — the ONLY paths that may change these columns. This
-- also closes the earlier note that a direct self-update skipped deactivated_at
-- stamping: status now changes solely via the stamping RPCs.
create or replace function profiles_guard_privileged()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('service_role','postgres') then
    new.is_admin       := old.is_admin;
    new.account_status := old.account_status;
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged before update on profiles
  for each row execute function profiles_guard_privileged();

-- Reporter reads their own reports; admins read all. (service_role still reads
-- via BYPASSRLS.) Insert-self policy from 0001 is unchanged.
drop policy if exists "reports read own or admin" on reports;
create policy "reports read own or admin" on reports for select to authenticated
  using (reporter_id = auth.uid() or is_admin(auth.uid()));

-- ── Account suspension (§53): add 'suspended' to the lifecycle ───────────────
-- is_active_account (0013) already treats any non-'active' status as inactive, so
-- a suspended account is hidden/non-interactable just like a deactivated one.
alter table profiles drop constraint if exists profiles_account_status_chk;
alter table profiles add  constraint profiles_account_status_chk
  check (account_status in ('active','deactivated','suspended'));

-- A suspended user must NOT be able to self-reactivate: reactivation only lifts a
-- user's OWN self-deactivation, never an admin suspension.
create or replace function reactivate_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set account_status = 'active', deactivated_at = null
    where id = auth.uid() and account_status = 'deactivated';
end $$;

-- ── Moderation action log (§62) ──────────────────────────────────────────────
create table if not exists moderation_actions (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references auth.users(id) on delete set null,
  action         text not null check (action in ('remove_mark','suspend_account','resolve_report','dismiss_report')),
  target_mark_id uuid references marks(id)      on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  report_id      uuid references reports(id)    on delete set null,
  reason         text,
  created_at     timestamptz not null default now()
);
alter table moderation_actions enable row level security;

-- Admins read the log; nobody writes it directly (only the DEFINER RPCs below do).
drop policy if exists "moderation_actions read admin" on moderation_actions;
create policy "moderation_actions read admin" on moderation_actions for select to authenticated
  using (is_admin(auth.uid()));
revoke insert, update, delete on moderation_actions from authenticated;

-- ── Admin RPCs (SECURITY DEFINER, is_admin-gated) ────────────────────────────
-- Each authorizes the caller as an admin FIRST (via auth.uid(), request-scoped),
-- then performs the action as the definer (so it bypasses per-user RLS/quota) and
-- records a moderation_action. Not reachable by ordinary users.

create or replace function admin_remove_mark(p_mark_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  -- runs as definer → privileged in marks_guard_moderation (no window/quota); the
  -- 'moderation' reason is never quota-limited (§33 safety/moderation unlimited).
  update marks set status = 'removed', removed_by = auth.uid(), removal_reason = 'moderation'
    where id = p_mark_id;
  insert into moderation_actions (actor_id, action, target_mark_id, reason)
    values (auth.uid(), 'remove_mark', p_mark_id, p_reason);
end $$;

create or replace function admin_suspend_account(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  update profiles set account_status = 'suspended', deactivated_at = now() where id = p_user_id;
  insert into moderation_actions (actor_id, action, target_user_id, reason)
    values (auth.uid(), 'suspend_account', p_user_id, p_reason);
end $$;

create or replace function admin_resolve_report(p_report_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status not in ('resolved','dismissed') then raise exception 'bad_status'; end if;
  update reports set status = p_status, resolved_by = auth.uid(), resolved_at = now()
    where id = p_report_id;
  insert into moderation_actions (actor_id, action, report_id, reason)
    values (auth.uid(), case when p_status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
            p_report_id, p_reason);
end $$;

revoke all on function admin_remove_mark(uuid, text)      from public;
revoke all on function admin_suspend_account(uuid, text)  from public;
revoke all on function admin_resolve_report(uuid, text, text) from public;
grant execute on function admin_remove_mark(uuid, text)      to authenticated;
grant execute on function admin_suspend_account(uuid, text)  to authenticated;
grant execute on function admin_resolve_report(uuid, text, text) to authenticated;
