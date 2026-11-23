-- Isolated standard Poll ballot and author-close draft. Deployment NOT authorized.
-- Source builds on 0035; service-owned rollout stays OFF by default.
begin;
alter table public.mark_poll_rollout add column voting_enabled boolean not null default false;

create table public.mark_poll_ballots (
  mark_id uuid not null references public.mark_polls(mark_id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  primary key (mark_id, voter_id)
);
create table public.mark_poll_ballot_choices (
  mark_id uuid not null,
  voter_id uuid not null,
  option_id uuid not null,
  primary key (mark_id, voter_id, option_id),
  constraint poll_choice_ballot_fk foreign key (mark_id, voter_id)
    references public.mark_poll_ballots(mark_id, voter_id) on delete cascade deferrable initially deferred,
  constraint poll_choice_option_fk foreign key (mark_id, option_id)
    references public.mark_poll_options(mark_id, option_id) on delete cascade deferrable initially deferred
);
create table public.mark_poll_mutation_requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('ballot','close')),
  mark_id uuid references public.mark_polls(mark_id) on delete cascade,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  primary key (actor_id, request_id)
);

alter table public.mark_poll_ballots enable row level security;
alter table public.mark_poll_ballot_choices enable row level security;
alter table public.mark_poll_mutation_requests enable row level security;
revoke all on public.mark_poll_ballots, public.mark_poll_ballot_choices,
  public.mark_poll_mutation_requests from public, anon, authenticated, service_role;

-- Enforce selection cardinality even for privileged direct writes. Deletion of
-- an Auth identity cascades ballots and their choices, including closed polls.
create function public.check_poll_ballot_cardinality()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_mark uuid;
  v_voter uuid;
  v_mode text;
  v_count integer;
begin
  v_mark := case when tg_op = 'DELETE' then old.mark_id else new.mark_id end;
  v_voter := case when tg_op = 'DELETE' then old.voter_id else new.voter_id end;
  if tg_op = 'UPDATE' and (new.mark_id is distinct from old.mark_id or new.voter_id is distinct from old.voter_id) then
    raise exception 'POLL_BALLOT_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;
  if not exists (select 1 from public.mark_poll_ballots b where b.mark_id=v_mark and b.voter_id=v_voter) then
    return null;
  end if;
  select p.selection_mode into v_mode from public.mark_polls p where p.mark_id=v_mark;
  select count(*) into v_count from public.mark_poll_ballot_choices c
    where c.mark_id=v_mark and c.voter_id=v_voter;
  if v_mode is null or (v_mode='single' and v_count<>1)
     or (v_mode='multiple' and v_count not between 1 and 6) then
    raise exception 'POLL_BALLOT_CARDINALITY' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger poll_ballot_cardinality
  after insert or update or delete on public.mark_poll_ballots
  deferrable initially deferred for each row execute function public.check_poll_ballot_cardinality();
create constraint trigger poll_ballot_choices_cardinality
  after insert or update or delete on public.mark_poll_ballot_choices
  deferrable initially deferred for each row execute function public.check_poll_ballot_cardinality();

-- One ballot per voter. Replacements are atomic and retry-safe under the poll
-- row lock. No caller-supplied voter_id or read of other voters is accepted.
-- Serialize against Wall membership, account lifecycle, blocks and Mark removal.
-- Mark removal may already own the parent before it locks a profile. Never wait
-- on either of those rows while holding the other in this opposite direction.
create function public.lock_poll_mutation_target(p_actor uuid,p_wall_id uuid,p_mark_id uuid)
returns public.marks language plpgsql security definer set search_path = pg_catalog, public as $
declare
  v_owner uuid;
  v_wall_type public.wall_type;
  v_author uuid;
  v_mark public.marks%rowtype;
  v_pair record;
begin
  if p_actor is null or p_actor is distinct from auth.uid() then return null; end if;
  select w.owner_id,w.type into v_owner,v_wall_type from public.walls w
    where w.id=p_wall_id for share;
  if not found then return null; end if;
  select m.author_id into v_author from public.marks m
    where m.id=p_mark_id and m.wall_id=p_wall_id and m.type='poll' and m.status='active'
      and not m.secret and not m.anonymous;
  if not found or v_author is null then return null; end if;

  perform p.id from public.profiles p where p.id in (p_actor,v_author,v_owner)
    order by p.id for share nowait;

  -- Each relationship uses the same key as the existing block trigger. Take
  -- both relevant author and Personal Wall pairs in deterministic order, without duplicates.
  for v_pair in
    select distinct least(p_actor,other_actor) as first_actor,greatest(p_actor,other_actor) as second_actor
      from (values (v_author),(case when v_wall_type='personal' then v_owner end)) as pairs(other_actor)
      where other_actor is not null and other_actor <> p_actor
      order by first_actor,second_actor
  loop
    perform public.lock_user_pair(v_pair.first_actor,v_pair.second_actor);
  end loop;

  select * into v_mark from public.marks m
    where m.id=p_mark_id and m.wall_id=p_wall_id and m.type='poll' and m.status='active'
    for share nowait;
  if not found or v_mark.secret or v_mark.anonymous or v_mark.author_id is distinct from v_author
     or not public.is_active_account(p_actor) or not public.is_active_account(v_author)
     or not public.can_view_wall(p_wall_id,p_actor) or public.is_blocked(p_actor,v_author) then
    return null;
  end if;
  return v_mark;
exception when lock_not_available then
  -- An overlapping state change has no authorized result yet. The caller may
  -- refresh/retry; it must not get a stale receipt or mutate a ballot.
  return null;
end $;
revoke all on function public.lock_poll_mutation_target(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;

create function public.replace_poll_ballot(
  p_expected_actor_id uuid, p_request_id uuid, p_wall_id uuid, p_mark_id uuid,
  p_expected_poll_revision bigint, p_expected_ballot_revision bigint, p_option_ids uuid[]
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  v_actor uuid := auth.uid();
  v_mark public.marks%rowtype;
  v_poll public.mark_polls%rowtype;
  v_old_revision bigint;
  v_revision bigint;
  v_options uuid[];
  v_hash text;
  v_receipt public.mark_poll_mutation_requests%rowtype;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
    or not public.is_active_account(v_actor) then return '{"status":"unavailable"}'::jsonb; end if;
  if p_request_id is null or p_wall_id is null or p_mark_id is null
    or p_expected_poll_revision is null or p_expected_poll_revision < 1
    or p_expected_ballot_revision is null or p_expected_ballot_revision < 0
    or array_ndims(p_option_ids) is distinct from 1
    or cardinality(p_option_ids) not between 1 and 6
    or (select count(distinct option_id) from unnest(p_option_ids) t(option_id)) <> cardinality(p_option_ids) then
    return '{"status":"invalid"}'::jsonb;
  end if;
  select array_agg(option_id order by option_id) into v_options from unnest(p_option_ids) t(option_id);
  if exists (select 1 from unnest(v_options) t(option_id) where option_id is null) then
    return '{"status":"invalid"}'::jsonb;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,83));
  v_mark := public.lock_poll_mutation_target(v_actor,p_wall_id,p_mark_id);
  if v_mark.id is null or not (
    exists (select 1 from public.walls w where w.id=p_wall_id and w.owner_id=v_actor)
    or public.can_contribute(p_wall_id,v_actor)
  ) then return '{"status":"unavailable"}'::jsonb; end if;
  select * into v_poll from public.mark_polls p where p.mark_id=p_mark_id and p.wall_id=p_wall_id for update;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  select * into v_receipt from public.mark_poll_mutation_requests r
    where r.actor_id=v_actor and r.request_id=p_request_id for update;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'version',1,'kind','ballot','wall_id',p_wall_id,'mark_id',p_mark_id,
    'poll_revision',p_expected_poll_revision,'ballot_revision',p_expected_ballot_revision,
    'options',to_jsonb(v_options))::text,'UTF8'),'sha256'),'hex');
  if found then
    if v_receipt.kind<>'ballot' or v_receipt.mark_id is distinct from p_mark_id
      or v_receipt.request_sha256<>v_hash then
      return '{"status":"request_id_reused"}'::jsonb;
    end if;
    select b.revision into v_revision from public.mark_poll_ballots b
      where b.mark_id=p_mark_id and b.voter_id=v_actor;
    if not found then return '{"status":"unavailable"}'::jsonb; end if;
    return jsonb_build_object('status','existing','mark_id',p_mark_id,
      'revision',v_poll.revision,'ballot',jsonb_build_object('revision',v_revision,
      'option_ids',(select coalesce(jsonb_agg(c.option_id order by c.option_id),'[]'::jsonb)
       from public.mark_poll_ballot_choices c where c.mark_id=p_mark_id and c.voter_id=v_actor)));
  end if;
  perform 1 from public.mark_poll_rollout r where r.singleton and r.voting_enabled for share;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  if v_poll.closed_at is not null then return '{"status":"closed"}'::jsonb; end if;
  if v_poll.revision<>p_expected_poll_revision then return '{"status":"conflict"}'::jsonb; end if;
  if v_poll.selection_mode='single' and cardinality(v_options)<>1 then
    return '{"status":"invalid"}'::jsonb;
  end if;
  if (select count(*) from public.mark_poll_options o
      where o.mark_id=p_mark_id and o.option_id=any(v_options))<>cardinality(v_options) then
    return '{"status":"invalid"}'::jsonb;
  end if;
  select b.revision into v_old_revision from public.mark_poll_ballots b
    where b.mark_id=p_mark_id and b.voter_id=v_actor for update;
  if coalesce(v_old_revision,0)<>p_expected_ballot_revision then
    return '{"status":"conflict"}'::jsonb;
  end if;
  insert into public.mark_poll_ballots(mark_id,voter_id,revision)
    values (p_mark_id,v_actor,coalesce(v_old_revision,0)+1)
    on conflict (mark_id,voter_id) do update set revision=excluded.revision
    returning revision into v_revision;
  delete from public.mark_poll_ballot_choices where mark_id=p_mark_id and voter_id=v_actor;
  insert into public.mark_poll_ballot_choices(mark_id,voter_id,option_id)
    select p_mark_id,v_actor,option_id from unnest(v_options) t(option_id);
  insert into public.mark_poll_mutation_requests(actor_id,request_id,kind,mark_id,request_sha256)
    values (v_actor,p_request_id,'ballot',p_mark_id,v_hash);
  return jsonb_build_object('status','applied','mark_id',p_mark_id,
    'revision',v_poll.revision,'ballot',jsonb_build_object('revision',v_revision,
    'option_ids',to_jsonb(v_options)));
end $$;

-- Close is one-way. The author is the only caller; there is no reopen API.
create function public.close_poll_mark(
  p_expected_actor_id uuid, p_request_id uuid, p_wall_id uuid, p_mark_id uuid,
  p_expected_poll_revision bigint
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  v_actor uuid := auth.uid();
  v_mark public.marks%rowtype;
  v_poll public.mark_polls%rowtype;
  v_hash text;
  v_receipt public.mark_poll_mutation_requests%rowtype;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
    or not public.is_active_account(v_actor) then return '{"status":"unavailable"}'::jsonb; end if;
  if p_request_id is null or p_wall_id is null or p_mark_id is null
    or p_expected_poll_revision is null or p_expected_poll_revision < 1 then
    return '{"status":"invalid"}'::jsonb; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,83));
  v_mark := public.lock_poll_mutation_target(v_actor,p_wall_id,p_mark_id);
  if v_mark.id is null or v_mark.author_id is distinct from v_actor then
    return '{"status":"unavailable"}'::jsonb;
  end if;
  select * into v_poll from public.mark_polls p where p.mark_id=p_mark_id and p.wall_id=p_wall_id for update;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'version',1,'kind','close','wall_id',p_wall_id,'mark_id',p_mark_id,
    'poll_revision',p_expected_poll_revision)::text,'UTF8'),'sha256'),'hex');
  select * into v_receipt from public.mark_poll_mutation_requests r
    where r.actor_id=v_actor and r.request_id=p_request_id for update;
  if found then
    if v_receipt.kind<>'close' or v_receipt.mark_id is distinct from p_mark_id
      or v_receipt.request_sha256<>v_hash then return '{"status":"request_id_reused"}'::jsonb; end if;
    return jsonb_build_object('status','existing','mark_id',p_mark_id,'revision',v_poll.revision);
  end if;
  perform 1 from public.mark_poll_rollout r where r.singleton and r.voting_enabled for share;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  if v_poll.closed_at is not null then return '{"status":"closed"}'::jsonb; end if;
  if v_poll.revision<>p_expected_poll_revision then return '{"status":"conflict"}'::jsonb; end if;
  update public.mark_polls p set closed_at=clock_timestamp(),revision=p.revision+1
    where p.mark_id=p_mark_id returning * into v_poll;
  insert into public.mark_poll_mutation_requests(actor_id,request_id,kind,mark_id,request_sha256)
    values (v_actor,p_request_id,'close',p_mark_id,v_hash);
  return jsonb_build_object('status','closed','mark_id',p_mark_id,'revision',v_poll.revision);
end $$;

-- Existing v2-only projection: aggregate snapshots are derived from surviving
-- ballots, not frozen. Auth deletion cascades votes on open AND closed polls.
create or replace function public.poll_mark_envelope_v2(p_mark public.marks, p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_parent jsonb;
  v_definition public.mark_polls%rowtype;
  v_options jsonb;
  v_counts jsonb;
  v_total bigint;
  v_vote_enabled boolean;
  v_ballot jsonb;
  v_can_vote boolean;
begin
  if p_mark.status<>'active' or not public.can_view_wall(p_mark.wall_id,p_actor) then return null; end if;
  if p_mark.type not in ('text','photo','voice','video','poll') then return null; end if;
  v_parent := jsonb_build_object(
    'id',p_mark.id,'wall_id',p_mark.wall_id,
    'author_id',case when p_mark.anonymous then null else p_mark.author_id end,
    'type',p_mark.type,'text',p_mark.text,'color',p_mark.color,
    'anonymous',p_mark.anonymous,'secret',p_mark.secret,'rotation',p_mark.rotation,
    'pinned',p_mark.pinned,'status',p_mark.status,'created_at',p_mark.created_at);
  if p_mark.type<>'poll' then return jsonb_build_object('kind','mark','mark',v_parent); end if;
  if p_mark.secret or p_mark.anonymous or p_mark.author_id is null
    or not public.is_active_account(p_mark.author_id)
    or public.is_blocked(p_actor,p_mark.author_id) then return null; end if;
  select * into v_definition from public.mark_polls p
    where p.mark_id=p_mark.id and p.wall_id=p_mark.wall_id;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('option_id',o.option_id,
    'position',o.position,'label',o.label) order by o.position),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('option_id',o.option_id,
    'count',(select count(*) from public.mark_poll_ballot_choices c
       where c.mark_id=p_mark.id and c.option_id=o.option_id)) order by o.position),'[]'::jsonb)
    into v_options,v_counts from public.mark_poll_options o where o.mark_id=p_mark.id;
  select count(*) into v_total from public.mark_poll_ballots b where b.mark_id=p_mark.id;
  select jsonb_build_object('revision',b.revision,
    'option_ids',(select coalesce(jsonb_agg(c.option_id order by c.option_id),'[]'::jsonb)
      from public.mark_poll_ballot_choices c
      where c.mark_id=b.mark_id and c.voter_id=b.voter_id))
    into v_ballot from public.mark_poll_ballots b where b.mark_id=p_mark.id and b.voter_id=p_actor;
  select r.voting_enabled into v_vote_enabled from public.mark_poll_rollout r where singleton;
  v_can_vote := coalesce(v_vote_enabled,false) and v_definition.closed_at is null
    and public.is_active_account(p_actor) and exists(
      select 1 from public.walls w where w.id=p_mark.wall_id
      and (w.owner_id=p_actor or public.can_contribute(p_mark.wall_id,p_actor)));
  return jsonb_build_object('kind','poll','mark',v_parent,'poll',jsonb_build_object(
    'mark_id',p_mark.id,'revision',v_definition.revision,
    'selection_mode',v_definition.selection_mode,'question',v_definition.question,
    'options',v_options,
    'state',case when v_definition.closed_at is null then 'open' else 'closed' end,
    'capabilities',jsonb_build_object('can_vote',v_can_vote,'can_edit',false,
      'can_close',coalesce(v_vote_enabled,false) and v_definition.closed_at is null
        and p_mark.author_id=p_actor),
    'ballot',v_ballot,'results',jsonb_build_object('ballot_total',v_total,'counts',v_counts)));
end $$;

revoke all on function public.check_poll_ballot_cardinality(),
  public.replace_poll_ballot(uuid,uuid,uuid,uuid,bigint,bigint,uuid[]),
  public.close_poll_mark(uuid,uuid,uuid,uuid,bigint),
  public.poll_mark_envelope_v2(public.marks,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.replace_poll_ballot(uuid,uuid,uuid,uuid,bigint,bigint,uuid[]),
  public.close_poll_mark(uuid,uuid,uuid,uuid,bigint) to authenticated;
commit;
