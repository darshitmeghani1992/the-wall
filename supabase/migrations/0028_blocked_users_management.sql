-- ============================================================================
-- 0028 · Privacy-safe Blocked Users management read
--
-- Normal profile RLS deliberately hides both sides of a blocked relationship.
-- This narrow, actor-bound RPC lets an active blocker manage only their own
-- outbound list without exposing inbound blocks, arbitrary users, or profile
-- fields beyond the five values required by Settings.
--
-- Rollback (client-first): remove all callers of list_my_blocked_users, revoke
-- EXECUTE from authenticated, then drop the exact three-argument function.
-- The migration writes no rows, so no data rollback is required.
-- ============================================================================

create or replace function public.list_my_blocked_users(
  p_expected_actor_id uuid,
  p_before_blocked_at timestamptz default null,
  p_before_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_account_status text;
  v_items jsonb;
  v_page_count integer;
  v_next_blocked_at timestamptz;
  v_next_user_id uuid;
begin
  -- This check intentionally precedes account and cursor validation so stale
  -- screens cannot use a newly-selected account to inspect any relationship.
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;

  select p.account_status
    into v_account_status
    from public.profiles p
   where p.id = v_actor;

  if not found or v_account_status <> 'active' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if (p_before_blocked_at is null) is distinct from (p_before_user_id is null) then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  with page as (
    select
      b.blocked_id as user_id,
      p.display_name,
      p.handle,
      p.avatar_url,
      b.created_at as blocked_at,
      row_number() over (order by b.created_at desc, b.blocked_id desc) as page_row
    from public.blocks b
    join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = v_actor
      and (
        p_before_blocked_at is null
        or (b.created_at, b.blocked_id) < (p_before_blocked_at, p_before_user_id)
      )
    order by b.created_at desc, b.blocked_id desc
    limit 21
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', page.user_id,
          'display_name', page.display_name,
          'handle', page.handle,
          'avatar_url', page.avatar_url,
          'blocked_at', page.blocked_at
        ) order by page.blocked_at desc, page.user_id desc
      ) filter (where page.page_row <= 20),
      '[]'::jsonb
    ),
    count(*)::integer,
    max(page.blocked_at) filter (where page.page_row = 20),
    (max(page.user_id::text) filter (where page.page_row = 20))::uuid
  into v_items, v_page_count, v_next_blocked_at, v_next_user_id
  from page;

  return jsonb_build_object(
    'status', 'available',
    'items', v_items,
    'next_cursor', case
      when v_page_count = 21 then jsonb_build_object(
        'blocked_at', v_next_blocked_at,
        'user_id', v_next_user_id
      )
      else null
    end
  );
end
$$;

revoke all on function public.list_my_blocked_users(uuid, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_my_blocked_users(uuid, timestamptz, uuid)
  to authenticated;
