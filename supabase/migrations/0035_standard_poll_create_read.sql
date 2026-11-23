-- ADR-017 standard Poll persistence draft. Deployment is not authorized.
-- Apply only from the pre-Poll baseline. The private parent never enters public.marks.
begin;

create table public.mark_poll_rollout (
  singleton boolean primary key default true check (singleton),
  creation_enabled boolean not null default false
);
insert into public.mark_poll_rollout(singleton) values (true);

create table public.mark_polls (
  mark_id uuid primary key,
  wall_id uuid not null references public.walls(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  status public.mark_status not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  question text not null check (char_length(btrim(question)) between 1 and 500),
  selection_mode text not null check (selection_mode in ('single', 'multiple')),
  revision bigint not null default 1 check (revision > 0),
  closed_at timestamptz
);
create index mark_polls_wall_active_order_idx on public.mark_polls
  (wall_id,pinned desc,created_at desc,mark_id desc) where status='active';

create table public.mark_poll_options (
  mark_id uuid not null references public.mark_polls(mark_id) on delete cascade,
  option_id uuid not null default gen_random_uuid(),
  position smallint not null check (position between 0 and 5),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  primary key (mark_id, option_id),
  unique (mark_id, position)
);
create unique index mark_poll_options_distinct_label
  on public.mark_poll_options(mark_id, lower(btrim(label)));

create table public.mark_poll_creation_requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  mark_id uuid unique references public.mark_polls(mark_id) on delete set null,
  primary key (actor_id, request_id)
);

alter table public.mark_poll_rollout enable row level security;
alter table public.mark_polls enable row level security;
alter table public.mark_poll_options enable row level security;
alter table public.mark_poll_creation_requests enable row level security;
revoke all on public.mark_poll_rollout, public.mark_polls, public.mark_poll_options,
  public.mark_poll_creation_requests from public, anon, authenticated, service_role;

-- Reject schema-wide or all-tables publications which include these relations.
do $publication$
begin
  if exists (
    select 1 from pg_catalog.pg_publication_tables
    where schemaname = 'public'
      and tablename in ('mark_polls','mark_poll_options','mark_poll_rollout','mark_poll_creation_requests')
  ) then
    raise exception 'POLL_STORAGE_MUST_BE_UNPUBLISHED';
  end if;
end $publication$;

-- Parent identity and modes cannot move between authors or Walls.
create function public.guard_poll_definition_identity()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.mark_id is distinct from old.mark_id or new.wall_id is distinct from old.wall_id
     or new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at
     or new.selection_mode is distinct from old.selection_mode then
    raise exception 'POLL_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger mark_poll_definition_identity before update on public.mark_polls
  for each row execute function public.guard_poll_definition_identity();

create function public.check_poll_definition_consistency()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_mark_id uuid;
  v_option_count integer;
  v_first_position smallint;
  v_last_position smallint;
begin
  if tg_op = 'UPDATE' and old.mark_id is distinct from new.mark_id then
    raise exception 'POLL_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;
  v_mark_id := case when tg_op = 'DELETE' then old.mark_id else new.mark_id end;
  if exists (select 1 from public.mark_polls p where p.mark_id = v_mark_id) then
    select count(*),min(o.position),max(o.position)
      into v_option_count,v_first_position,v_last_position from public.mark_poll_options o where o.mark_id = v_mark_id;
    if v_option_count not between 2 and 6 or v_first_position <> 0 or v_last_position <> v_option_count - 1 then
      raise exception 'POLL_OPTIONS_INVALID' using errcode = '23514';
    end if;
  end if;
  return null;
end $$;
create constraint trigger mark_poll_definition_consistency after insert or update or delete on public.mark_polls
  deferrable initially deferred for each row execute function public.check_poll_definition_consistency();
create constraint trigger mark_poll_option_consistency after insert or update or delete on public.mark_poll_options
  deferrable initially deferred for each row execute function public.check_poll_definition_consistency();

create function public.create_poll_mark(
  p_expected_actor_id uuid, p_request_id uuid, p_wall_id uuid, p_selection_mode text,
  p_question text, p_options text[], p_anonymous boolean, p_secret boolean
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_wall_type public.wall_type;
  v_requires_approval boolean;
  v_question text := btrim(p_question, E' \t\r\n');
  v_options text[];
  v_hash text;
  v_request public.mark_poll_creation_requests%rowtype;
  v_mark_id uuid;
  v_status public.mark_status;
  v_revision bigint;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id or not public.is_active_account(v_actor) then
    return '{"status":"unavailable"}'::jsonb;
  end if;
  if p_request_id is null or p_wall_id is null or p_selection_mode is null
     or p_selection_mode not in ('single','multiple') or p_secret is distinct from false
     or p_anonymous is distinct from false or v_question is null or char_length(v_question) not between 1 and 500
     or array_ndims(p_options) is distinct from 1 or cardinality(p_options) not between 2 and 6 then
    return '{"status":"invalid"}'::jsonb;
  end if;
  select array_agg(btrim(x.label, E' \t\r\n') order by x.position) into v_options
    from unnest(p_options) with ordinality x(label, position);
  if exists (select 1 from unnest(v_options) x(label) where label is null or char_length(label) not between 1 and 80)
     or (select count(distinct lower(label)) from unnest(v_options) x(label)) <> cardinality(v_options) then
    return '{"status":"invalid"}'::jsonb;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_request_id::text, 83));
  select w.owner_id, w.type, w.require_approval into v_owner, v_wall_type, v_requires_approval
    from public.walls w where w.id = p_wall_id for share;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  if v_wall_type = 'personal' then perform public.lock_user_pair(v_actor, v_owner); end if;
  if not public.is_active_account(v_actor) or not public.can_contribute(p_wall_id, v_actor) then return '{"status":"unavailable"}'::jsonb; end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'version', 1, 'wall_id', p_wall_id, 'selection_mode', p_selection_mode,
    'question', v_question, 'options', to_jsonb(v_options)
  )::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_request from public.mark_poll_creation_requests r
    where r.actor_id = v_actor and r.request_id = p_request_id;
  if found then
    select p.status, p.revision into v_status, v_revision from public.mark_polls p
      where p.mark_id = v_request.mark_id and p.wall_id = p_wall_id
        and p.status in ('active', 'pending') and p.author_id = v_actor;
    if not found then return '{"status":"unavailable"}'::jsonb; end if;
    if v_request.request_sha256 <> v_hash then return '{"status":"request_id_reused"}'::jsonb; end if;
    return jsonb_build_object('status','existing','mark_id',v_request.mark_id,'mark_status',v_status,'poll_revision',v_revision);
  end if;

  perform 1 from public.mark_poll_rollout where singleton and creation_enabled for share;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;

  v_mark_id := gen_random_uuid();
  v_status := case when v_owner <> v_actor and v_requires_approval
    then 'pending'::public.mark_status else 'active'::public.mark_status end;
  insert into public.mark_polls(mark_id, wall_id, author_id, status, question, selection_mode)
    values (v_mark_id, p_wall_id, v_actor, v_status, v_question, p_selection_mode);
  insert into public.mark_poll_options(mark_id, position, label)
    select v_mark_id, (position - 1)::smallint, label from unnest(v_options) with ordinality x(label, position);
  insert into public.mark_poll_creation_requests(actor_id, request_id, request_sha256, mark_id)
    values (v_actor, p_request_id, v_hash, v_mark_id);
  return jsonb_build_object('status','created','mark_id',v_mark_id,'mark_status',v_status,'poll_revision',1);
end $$;

-- Explicitly versioned projection: never grant Poll Mark rows via raw marks SELECT.
create function public.poll_mark_envelope_v2(p_mark public.marks, p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_parent jsonb;
begin
  if p_mark.status <> 'active' or not public.can_view_wall(p_mark.wall_id, p_actor) then return null; end if;
  if p_mark.type not in ('text','photo','voice','video') then return null; end if;
  v_parent := jsonb_build_object(
    'id',p_mark.id,'wall_id',p_mark.wall_id,'author_id',case when p_mark.anonymous then null else p_mark.author_id end,
    'type',p_mark.type,'text',p_mark.text,'color',p_mark.color,'anonymous',p_mark.anonymous,'secret',p_mark.secret,
    -- Keep the existing authorized photo/voice/video projection usable when
    -- callers move from raw Mark history to the mixed v2 Poll history. The
    -- protected-media URI is still acquired through the signed read endpoint;
    -- this only preserves the already RLS-readable Mark metadata fields.
    'media_url',p_mark.media_url,'payload',p_mark.payload,
    'rotation',p_mark.rotation,'pinned',p_mark.pinned,'status',p_mark.status,'created_at',p_mark.created_at
  );
  return jsonb_build_object('kind','mark','mark',v_parent);
end $$;

create function public.private_poll_envelope_v2(p_poll public.mark_polls, p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_parent jsonb;
  v_options jsonb;
  v_counts jsonb;
begin
  if p_actor is null or p_actor is distinct from auth.uid()
     or not public.is_active_account(p_actor)
     or not public.can_view_wall(p_poll.wall_id,p_actor) or p_poll.status <> 'active'
     or not public.is_active_account(p_poll.author_id) or public.is_blocked(p_actor,p_poll.author_id) then
    return null;
  end if;
  v_parent := jsonb_build_object(
    'id',p_poll.mark_id,'wall_id',p_poll.wall_id,'author_id',p_poll.author_id,
    'type','poll','text',null,'color',null,'anonymous',false,'secret',false,
    'rotation',0,'pinned',p_poll.pinned,'status',p_poll.status,'created_at',p_poll.created_at
  );
  select jsonb_agg(jsonb_build_object('option_id',o.option_id,'position',o.position,'label',o.label) order by o.position),
    jsonb_agg(jsonb_build_object('option_id',o.option_id,'count',0) order by o.position)
    into v_options,v_counts from public.mark_poll_options o where o.mark_id = p_poll.mark_id;
  return jsonb_build_object('kind','poll','mark',v_parent,'poll',jsonb_build_object(
    'mark_id',p_poll.mark_id,'revision',p_poll.revision,'selection_mode',p_poll.selection_mode,
    'question',p_poll.question,'options',v_options,
    'state',case when p_poll.closed_at is null then 'open' else 'closed' end,
    'capabilities',jsonb_build_object('can_vote',false,'can_edit',false,'can_close',false),
    'ballot',null,'results',jsonb_build_object('ballot_total',0,'counts',v_counts)
  ));
end $$;

create function public.get_wall_mark_v2(p_expected_actor_id uuid, p_wall_id uuid, p_mark_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid(); v_item jsonb; v_poll_item jsonb;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
     or not public.can_view_wall(p_wall_id,v_actor) then return '{"status":"unavailable"}'::jsonb; end if;
  select public.poll_mark_envelope_v2(m,v_actor) into v_item
    from public.marks m where m.id = p_mark_id and m.wall_id = p_wall_id and m.status = 'active';
  select public.private_poll_envelope_v2(p,v_actor) into v_poll_item
    from public.mark_polls p where p.mark_id = p_mark_id and p.wall_id = p_wall_id and p.status = 'active';
  -- This existing untyped focused boundary must fail closed on a visible
  -- cross-kind collision. Typed focus and mixed history are a later slice.
  if (v_item is null and v_poll_item is null) or (v_item is not null and v_poll_item is not null) then
    return '{"status":"unavailable"}'::jsonb;
  end if;
  return jsonb_build_object('status','available','item',coalesce(v_item,v_poll_item));
end $$;

-- Exact kind support for versioned callers and mixed history.
create function public.get_wall_mark_item_v2(
  p_expected_actor_id uuid, p_wall_id uuid, p_mark_id uuid, p_kind text
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid(); v_item jsonb;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
     or not public.can_view_wall(p_wall_id,v_actor) then return '{"status":"unavailable"}'::jsonb; end if;
  if p_kind = 'mark' then
    select public.poll_mark_envelope_v2(m,v_actor) into v_item from public.marks m
      where m.id=p_mark_id and m.wall_id=p_wall_id and m.status='active';
  elsif p_kind = 'poll' then
    select public.private_poll_envelope_v2(p,v_actor) into v_item from public.mark_polls p
      where p.mark_id=p_mark_id and p.wall_id=p_wall_id and p.status='active';
  end if;
  if v_item is null then return '{"status":"unavailable"}'::jsonb; end if;
  return jsonb_build_object('status','available','item',v_item);
end $$;

create function public.list_wall_marks_v2(
  p_expected_actor_id uuid, p_wall_id uuid, p_after_pinned boolean,
  p_after_created_at timestamptz, p_after_mark_id uuid, p_after_kind text, p_limit integer
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
  v_next jsonb;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
     or not public.can_view_wall(p_wall_id,v_actor) then return '{"status":"unavailable"}'::jsonb; end if;
  if p_limit is null or p_limit not between 1 and 20
     or num_nonnulls(p_after_pinned,p_after_created_at,p_after_mark_id,p_after_kind) not in (0,4)
     or (p_after_kind is not null and p_after_kind not in ('mark','poll')) then
    return '{"status":"invalid"}'::jsonb;
  end if;
  with candidates as (
    select m.id, m.created_at, m.pinned, 'mark'::text collate "C" as kind,
      public.poll_mark_envelope_v2(m,v_actor) as item
    from public.marks m
    where m.wall_id=p_wall_id and m.status='active'
    union all
    select p.mark_id, p.created_at, p.pinned, 'poll'::text collate "C" as kind,
      public.private_poll_envelope_v2(p,v_actor) as item
    from public.mark_polls p
    where p.wall_id=p_wall_id and p.status='active'
  ), page as materialized (
    select * from candidates
    where item is not null
      and (p_after_kind is null or (pinned,created_at,id,kind) <
        (p_after_pinned,p_after_created_at,p_after_mark_id,p_after_kind collate "C"))
    order by pinned desc,created_at desc,id desc,kind desc limit p_limit + 1
  ), numbered as (
    select *,row_number() over (order by pinned desc,created_at desc,id desc,kind desc) as position from page
  )
  select coalesce(jsonb_agg(item order by position) filter(where position <= p_limit), '[]'::jsonb),
    case when count(*) > p_limit then (
      select jsonb_build_object('pinned',pinned,'created_at',created_at,'mark_id',id,'kind',kind)
      from numbered where position = p_limit
    ) end
    into v_items,v_next from numbered;
  return jsonb_build_object('status','available','items',v_items,'next_cursor',v_next);
end $$;

create function public.read_poll_marks(p_expected_actor_id uuid, p_wall_id uuid, p_mark_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid(); v_items jsonb;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
     or not public.can_view_wall(p_wall_id,v_actor) then return '{"status":"unavailable"}'::jsonb; end if;
  if array_ndims(p_mark_ids) is distinct from 1 or cardinality(p_mark_ids) not between 1 and 20
     or (select count(distinct id) from unnest(p_mark_ids) x(id)) <> cardinality(p_mark_ids) then
    return '{"status":"invalid"}'::jsonb;
  end if;
  select coalesce(jsonb_agg(e.item->'poll' order by x.position), '[]'::jsonb) into v_items
    from unnest(p_mark_ids) with ordinality x(id,position)
    join public.mark_polls p on p.mark_id = x.id and p.wall_id = p_wall_id and p.status = 'active'
    cross join lateral (select public.private_poll_envelope_v2(p,v_actor) as item) e
    where e.item is not null;
  return jsonb_build_object('status','available','items',v_items);
end $$;

revoke all on function public.guard_poll_definition_identity(),public.private_poll_envelope_v2(public.mark_polls,uuid),
  public.check_poll_definition_consistency(),public.poll_mark_envelope_v2(public.marks,uuid),
  public.create_poll_mark(uuid,uuid,uuid,text,text,text[],boolean,boolean),
  public.get_wall_mark_v2(uuid,uuid,uuid),
  public.get_wall_mark_item_v2(uuid,uuid,uuid,text),
  public.list_wall_marks_v2(uuid,uuid,boolean,timestamptz,uuid,text,integer),
  public.read_poll_marks(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.create_poll_mark(uuid,uuid,uuid,text,text,text[],boolean,boolean),
  public.get_wall_mark_v2(uuid,uuid,uuid),
  public.get_wall_mark_item_v2(uuid,uuid,uuid,text),
  public.list_wall_marks_v2(uuid,uuid,boolean,timestamptz,uuid,text,integer),
  public.read_poll_marks(uuid,uuid,uuid[]) to authenticated;
commit;
