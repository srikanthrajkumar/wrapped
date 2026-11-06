-- Push, pull and the account operations (T073 to T075; contracts/sync-api.md; ADR 0001,
-- "Push and pull as Postgres functions").
--
-- The phone calls the functions in `public` through Supabase's API: `sync_push`,
-- `sync_pull`, `me`, `me_consent` and `devices_claim`. Each takes the contract's request body
-- as its one unnamed jsonb argument, so `supabase.rpc('sync_push', { deviceId, ops })` sends
-- the body exactly as the contract writes it. EXECUTE is granted to signed-in users only; an
-- anonymous call gets 401 from the API.
--
-- They all run as the caller (SECURITY INVOKER), so row-level security limits every read and
-- write inside them to the caller's own rows. The one exception is private.owned_by_another,
-- which must see another rasika's row to answer `foreign_rasika`; it returns only a yes or no.
--
-- Errors with a status of their own use PostgREST's custom error (private.raise_http). Its
-- body is { code, message, details, hint }; PostgREST takes `details` only as a string, so it
-- holds one plain value (ADR 0001).

-- ---------------------------------------------------------------------------------------------
-- Server settings
-- ---------------------------------------------------------------------------------------------

-- One row. Raise min_app_version when the sync format changes (eng review D14).
create table private.server_config (
  id boolean primary key default true check (id),
  min_app_version text not null check (min_app_version ~ '^\d{1,9}\.\d{1,9}\.\d{1,9}$'),
  -- Shown in Settings as the place to ask for deletion (FR-046). Set on each server by hand.
  deletion_contact text
);

insert into private.server_config (min_app_version) values ('0.1.0');

alter table private.server_config enable row level security;
create policy server_config_read on private.server_config
  for select to authenticated
  using (true);
grant select on private.server_config to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers (private, not exposed)
-- ---------------------------------------------------------------------------------------------

-- Ends the request with an HTTP status and PostgREST's error body.
create function private.raise_http(
  p_status integer,
  p_code text,
  p_message text,
  p_details text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise sqlstate 'PGRST' using
    message = jsonb_build_object(
      'code', p_code,
      'message', p_message,
      'details', p_details,
      'hint', null
    )::text,
    detail = jsonb_build_object('status', p_status, 'headers', '{}'::jsonb)::text;
end;
$$;

-- True when `p_version` (MAJOR.MINOR.PATCH, anything after ignored) is at least `p_minimum`.
-- A missing or malformed version is below every minimum.
create function private.version_at_least(p_version text, p_minimum text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_version ~ '^\d{1,9}\.\d{1,9}\.\d{1,9}([-+.].*)?$'
      and string_to_array(substring(p_version from '^\d+\.\d+\.\d+'), '.')::integer[]
        >= string_to_array(p_minimum, '.')::integer[],
    false
  )
$$;

-- PostgREST's pre-request function: every API call checks the app version once, here
-- (contracts/sync-api.md, "Errors").
create function private.check_request()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_version text := current_setting('request.headers', true)::jsonb ->> 'x-app-version';
  v_minimum text;
begin
  select c.min_app_version into v_minimum from private.server_config c;
  if not private.version_at_least(v_version, v_minimum) then
    perform private.raise_http(426, 'update_required', 'Update the app to keep syncing', v_minimum);
  end if;
end;
$$;

-- The caller's rasika id. A signed-in user always has one (0001_accounts.sql); a user whose
-- row is gone gets 403.
create function private.require_rasika()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rasika uuid := private.current_rasika_id();
begin
  if v_rasika is null then
    perform private.raise_http(403, 'no_account', 'This sign-in has no Carnatic Wrapped account');
  end if;
  return v_rasika;
end;
$$;

-- Serialises a rasika's writes: push, claim and consent, and later the Maintainer's Links
-- (T076, Phase 8). Rows written under it commit in `seq` order, which pull relies on.
create function private.lock_rasika(p_rasika uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(1, hashtext(p_rasika::text))
$$;

create function private.bad_request(p_message text)
returns void
language sql
set search_path = ''
as $$
  select private.raise_http(400, 'bad_request', p_message)
$$;

-- Whether a record id already belongs to another rasika (`foreign_rasika`). It must look past
-- row-level security, so it runs as the owner; it answers only yes or no, and only for the
-- signed-in caller.
create function private.owned_by_another(p_table text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_rasika_id();
  v_owner uuid;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_table not in ('events', 'appearances', 'items', 'artists', 'sabhas') then
    raise exception 'unknown table %', p_table using errcode = '22023';
  end if;
  execute format('select t.rasika_id from private.%I t where t.id = $1', p_table)
    into v_owner
    using p_id;
  return v_owner is not null and v_owner <> v_me;
end;
$$;

-- Applies one op for push. Returns the record's new `seq`, or a rejection `code` and
-- `message`, and `previous_seq`, the record's seq before this op. The caller holds the
-- rasika's lock and records the result in processed_op.
--
-- `p_push_start_seq` is the record's seq before the current push, when an earlier op in the
-- same push already wrote it. The phone fills each op's baseSeq from the acks it has, so two
-- ops on one record in one batch both carry the seq from before the batch; the second is the
-- same device's later edit, not a conflict.
create function private.apply_op(
  p_rasika uuid,
  p_op jsonb,
  p_push_start_seq bigint,
  out seq bigint,
  out code text,
  out message text,
  out previous_seq bigint
)
language plpgsql
set search_path = ''
as $$
declare
  v_table text := p_op ->> 'table';
  v_row jsonb := p_op -> 'row';
  v_base_json jsonb := p_op -> 'baseSeq';
  v_base bigint;
  v_id uuid;
  v_has_parent boolean;
  v_event_id uuid;
  v_deleted_at timestamptz;
  v_parent_deleted_at timestamptz;
begin
  -- The op's shape. The server checks only ids, owners and the parent Event (eng review D7).
  if v_table is null or v_table not in ('events', 'appearances', 'items', 'artists', 'sabhas') then
    code := 'invalid_op';
    message := format('Unknown table %s', coalesce(v_table, '(none)'));
    return;
  end if;
  if jsonb_typeof(v_row) is distinct from 'object'
    or not pg_input_is_valid(coalesce(v_row ->> 'id', ''), 'uuid') then
    code := 'invalid_op';
    message := 'The row needs a uuid id';
    return;
  end if;
  if jsonb_typeof(v_base_json) is distinct from 'number'
    or not pg_input_is_valid(v_base_json #>> '{}', 'bigint') then
    code := 'invalid_op';
    message := 'baseSeq must be a whole number';
    return;
  end if;
  v_base := (v_base_json #>> '{}')::bigint;
  if jsonb_typeof(v_row -> 'deletedAt') = 'string' then
    if not pg_input_is_valid(v_row ->> 'deletedAt', 'timestamptz') then
      code := 'invalid_op';
      message := 'deletedAt must be a timestamp or null';
      return;
    end if;
    v_deleted_at := (v_row ->> 'deletedAt')::timestamptz;
  elsif jsonb_typeof(v_row -> 'deletedAt') not in ('null') then
    code := 'invalid_op';
    message := 'deletedAt must be a timestamp or null';
    return;
  end if;
  v_has_parent := v_table in ('appearances', 'items');
  if v_has_parent then
    if not pg_input_is_valid(coalesce(v_row ->> 'eventId', ''), 'uuid') then
      code := 'invalid_op';
      message := 'The row needs a uuid eventId';
      return;
    end if;
    v_event_id := (v_row ->> 'eventId')::uuid;
  end if;
  v_id := (v_row ->> 'id')::uuid;

  -- The owner: an id another rasika holds is never written (constitution, Privacy).
  if private.owned_by_another(v_table, v_id) then
    code := 'foreign_rasika';
    message := 'This id belongs to another account';
    return;
  end if;

  -- The version: baseSeq must be the record's current seq, 0 for a new one (eng review D11).
  execute format('select t.seq from private.%I t where t.id = $1', v_table)
    into previous_seq
    using v_id;
  previous_seq := coalesce(previous_seq, 0);
  if v_base <> previous_seq and v_base is distinct from p_push_start_seq then
    code := 'conflict';
    message := format('The server has a newer version (seq %s)', previous_seq);
    return;
  end if;

  -- The parent: a live Appearance or Item needs a live Event of the same rasika. A tombstone
  -- needs only the Event, which the phone deletes after its children.
  if v_has_parent then
    select e.deleted_at into v_parent_deleted_at from private.events e where e.id = v_event_id;
    if not found then
      code := 'missing_event';
      message := 'The Event is not on the server';
      return;
    end if;
    if v_deleted_at is null and v_parent_deleted_at is not null then
      code := 'missing_event';
      message := 'The Event is deleted';
      return;
    end if;
  end if;

  -- One generic upsert for all five tables: the row replaces the stored one whole and takes a
  -- new seq. A delete is the same upsert with deletedAt set, kept as a tombstone.
  seq := nextval('private.season_seq');
  if v_has_parent then
    execute format(
      'insert into private.%I as t (id, rasika_id, seq, deleted_at, event_id, data)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set
         seq = excluded.seq,
         deleted_at = excluded.deleted_at,
         received_at = now(),
         event_id = excluded.event_id,
         data = excluded.data',
      v_table)
      using v_id, p_rasika, seq, v_deleted_at, v_event_id, v_row;
  else
    execute format(
      'insert into private.%I as t (id, rasika_id, seq, deleted_at, data)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         seq = excluded.seq,
         deleted_at = excluded.deleted_at,
         received_at = now(),
         data = excluded.data',
      v_table)
      using v_id, p_rasika, seq, v_deleted_at, v_row;
  end if;
end;
$$;

-- Everything a pull returns from the rasika's own side, in one shape: the five tables and
-- their Links, each with the `seq` pull pages by. Runs as the caller, so row-level security
-- applies.
create view private.season_change
with (security_invoker = true)
as
  select 'events'::text as tbl, t.rasika_id, t.seq, t.data from private.events t
  union all
  select 'appearances', t.rasika_id, t.seq, t.data from private.appearances t
  union all
  select 'items', t.rasika_id, t.seq, t.data from private.items t
  union all
  select 'artists', t.rasika_id, t.seq, t.data from private.artists t
  union all
  select 'sabhas', t.rasika_id, t.seq, t.data from private.sabhas t
  union all
  select
    'links',
    l.rasika_id,
    l.seq,
    jsonb_build_object('id', l.id, 'ownTable', l.own_table, 'ownId', l.own_id, 'sharedId', l.shared_id)
  from private.link l;

-- The shared lists, paged by (list_version, id).
create view private.shared_change
with (security_invoker = true)
as
  select
    'sharedArtists'::text as tbl,
    a.list_version,
    a.id,
    jsonb_build_object('id', a.id, 'name', a.name, 'aliases', to_jsonb(a.aliases), 'listVersion', a.list_version) as data
  from private.shared_artist a
  union all
  select
    'sharedSabhas',
    s.list_version,
    s.id,
    jsonb_build_object('id', s.id, 'name', s.name, 'aliases', to_jsonb(s.aliases), 'listVersion', s.list_version)
  from private.shared_sabha s;

grant select on private.season_change, private.shared_change to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The API (public)
-- ---------------------------------------------------------------------------------------------

-- POST /v1/sync/push: { deviceId, ops } -> { acked, rejected } (contracts/sync-api.md, "Push").
create function public.sync_push(jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_body jsonb := coalesce($1, '{}'::jsonb);
  v_rasika uuid := private.require_rasika();
  v_ops jsonb := v_body -> 'ops';
  v_device text := v_body ->> 'deviceId';
  v_writer uuid;
  v_op jsonb;
  v_op_id uuid;
  v_record_id text;
  v_seq bigint;
  v_code text;
  v_message text;
  v_previous bigint;
  -- record id -> its seq before this push, for records an op in this push has written
  v_push_start jsonb := '{}'::jsonb;
  v_acked jsonb := '[]'::jsonb;
  v_rejected jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_ops) is distinct from 'array' then
    perform private.bad_request('ops must be an array');
  end if;
  if jsonb_array_length(v_ops) > 200 then
    perform private.bad_request('At most 200 ops per push');
  end if;
  if not pg_input_is_valid(coalesce(v_device, ''), 'uuid') then
    perform private.bad_request('deviceId must be a uuid');
  end if;

  -- One transaction under the rasika's lock: the writer check and every op see one state.
  perform private.lock_rasika(v_rasika);
  select r.writer_device_id into v_writer from private.rasika r where r.id = v_rasika;
  if v_writer is distinct from v_device::uuid then
    perform private.raise_http(409, 'not_writer', 'Another device is the writing device', v_writer::text);
  end if;

  for v_op in
    select e.value from jsonb_array_elements(v_ops) with ordinality as e (value, n) order by e.n
  loop
    if not pg_input_is_valid(coalesce(v_op ->> 'opId', ''), 'uuid') then
      perform private.bad_request('Every op needs a uuid opId');
    end if;
    v_op_id := (v_op ->> 'opId')::uuid;

    -- A repeated opId gets its first answer again and changes nothing (FR-015).
    select p.seq, p.code, p.message into v_seq, v_code, v_message
    from private.processed_op p
    where p.rasika_id = v_rasika and p.op_id = v_op_id;

    if not found then
      v_record_id := v_op #>> '{row,id}';
      select a.seq, a.code, a.message, a.previous_seq into v_seq, v_code, v_message, v_previous
      from private.apply_op(
        v_rasika,
        v_op,
        (v_push_start ->> coalesce(v_record_id, ''))::bigint
      ) a;
      if v_code is null and not v_push_start ? v_record_id then
        v_push_start := v_push_start || jsonb_build_object(v_record_id, v_previous);
      end if;
      insert into private.processed_op (rasika_id, op_id, seq, code, message)
      values (v_rasika, v_op_id, v_seq, v_code, v_message);
    end if;

    if v_code is null then
      v_acked := v_acked || jsonb_build_array(jsonb_build_object('opId', v_op_id, 'seq', v_seq));
    else
      v_rejected := v_rejected
        || jsonb_build_array(jsonb_build_object('opId', v_op_id, 'code', v_code, 'message', v_message));
    end if;
  end loop;

  return jsonb_build_object('acked', v_acked, 'rejected', v_rejected);
end;
$$;

-- GET /v1/sync/pull: { cursor?, limit? } -> { changes, cursor, more } (contracts/sync-api.md,
-- "Pull"). An own row or Link comes as { table, seq, row }; a shared entry as { table, row },
-- its version in row.listVersion. The cursor is `1:<own seq>:<list version>:<shared id>`; the phone treats it as
-- opaque. An empty or missing cursor returns everything (restore).
create function public.sync_pull(jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_body jsonb := coalesce($1, '{}'::jsonb);
  v_rasika uuid := private.require_rasika();
  v_cursor text := v_body ->> 'cursor';
  v_limit_json jsonb := v_body -> 'limit';
  v_limit integer := 500;
  v_parts text[];
  v_seq bigint := 0;
  v_version bigint := 0;
  v_shared_id uuid := '00000000-0000-0000-0000-000000000000';
  v_own jsonb;
  v_own_count integer;
  v_own_last bigint;
  v_shared jsonb := '[]'::jsonb;
  v_shared_count integer;
  v_shared_last_version bigint;
  v_shared_last_id uuid;
  v_room integer;
begin
  if v_limit_json is not null and jsonb_typeof(v_limit_json) <> 'null' then
    if jsonb_typeof(v_limit_json) <> 'number' or not pg_input_is_valid(v_limit_json #>> '{}', 'integer') then
      perform private.bad_request('limit must be a whole number');
    end if;
    v_limit := least(greatest((v_limit_json #>> '{}')::integer, 1), 500);
  end if;

  if coalesce(v_cursor, '') <> '' then
    v_parts := regexp_match(v_cursor, '^1:(\d+):(\d+):([0-9a-f-]{36})$');
    if v_parts is null
      or not pg_input_is_valid(v_parts[1], 'bigint')
      or not pg_input_is_valid(v_parts[2], 'bigint')
      or not pg_input_is_valid(v_parts[3], 'uuid') then
      perform private.bad_request('Unknown cursor');
    end if;
    v_seq := v_parts[1]::bigint;
    v_version := v_parts[2]::bigint;
    v_shared_id := v_parts[3]::uuid;
  end if;

  -- The rasika's own rows and Links, by seq. One extra row says whether there are more. Each
  -- carries its seq, the baseSeq the phone sends with its next edit of the record (D11).
  select
    coalesce(jsonb_agg(jsonb_build_object('table', p.tbl, 'seq', p.seq, 'row', p.data) order by p.seq)
      filter (where p.n <= v_limit), '[]'::jsonb),
    count(*),
    max(p.seq) filter (where p.n <= v_limit)
  into v_own, v_own_count, v_own_last
  from (
    select c.tbl, c.seq, c.data, row_number() over (order by c.seq) as n
    from (
      select c.tbl, c.seq, c.data
      from private.season_change c
      where c.rasika_id = v_rasika and c.seq > v_seq
      order by c.seq
      limit v_limit + 1
    ) c
  ) p;

  -- The shared lists fill what room is left, by (list_version, id).
  v_room := greatest(v_limit - v_own_count, 0);
  select
    coalesce(jsonb_agg(jsonb_build_object('table', p.tbl, 'row', p.data) order by p.n)
      filter (where p.n <= v_room), '[]'::jsonb),
    count(*)
  into v_shared, v_shared_count
  from (
    select s.tbl, s.list_version, s.id, s.data,
      row_number() over (order by s.list_version, s.id) as n
    from (
      select s.tbl, s.list_version, s.id, s.data
      from private.shared_change s
      where (s.list_version, s.id) > (v_version, v_shared_id)
      order by s.list_version, s.id
      limit v_room + 1
    ) s
  ) p;

  if v_room > 0 and v_shared_count > 0 then
    select s.list_version, s.id into v_shared_last_version, v_shared_last_id
    from private.shared_change s
    where (s.list_version, s.id) > (v_version, v_shared_id)
    order by s.list_version, s.id
    offset least(v_shared_count, v_room) - 1
    limit 1;
  end if;

  return jsonb_build_object(
    'changes', v_own || v_shared,
    'cursor', format(
      '1:%s:%s:%s',
      coalesce(v_own_last, v_seq),
      coalesce(v_shared_last_version, v_version),
      coalesce(v_shared_last_id, v_shared_id)
    ),
    'more', v_own_count > v_limit or v_shared_count > v_room
  );
end;
$$;

-- GET /v1/me (contracts/sync-api.md, "Account").
create function public.me()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rasika uuid := private.require_rasika();
begin
  return (
    select jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'shareAdditions', r.share_additions,
      'seasonReports', r.season_reports,
      'writerDeviceId', r.writer_device_id,
      'deletionContact', (select c.deletion_contact from private.server_config c)
    )
    from private.rasika r
    where r.id = v_rasika
  );
end;
$$;

-- PUT /v1/me/consent: { shareAdditions?, seasonReports? } -> both values. Each change appends
-- a consent event (FR-042, FR-049); an unchanged value appends nothing.
create function public.me_consent(jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_body jsonb := coalesce($1, '{}'::jsonb);
  v_rasika uuid := private.require_rasika();
  v_share jsonb := v_body -> 'shareAdditions';
  v_reports jsonb := v_body -> 'seasonReports';
  v_current_share boolean;
  v_current_reports boolean;
begin
  if jsonb_typeof(v_body) <> 'object'
    or (v_share is not null and jsonb_typeof(v_share) <> 'boolean')
    or (v_reports is not null and jsonb_typeof(v_reports) <> 'boolean') then
    perform private.bad_request('shareAdditions and seasonReports must be true or false');
  end if;

  perform private.lock_rasika(v_rasika);
  select r.share_additions, r.season_reports into v_current_share, v_current_reports
  from private.rasika r
  where r.id = v_rasika;

  if v_share is not null and v_current_share is distinct from (v_share::boolean) then
    v_current_share := v_share::boolean;
    update private.rasika set share_additions = v_current_share where id = v_rasika;
    insert into private.consent_event (rasika_id, purpose, value)
    values (v_rasika, 'share_additions', v_current_share);
  end if;
  if v_reports is not null and v_current_reports is distinct from (v_reports::boolean) then
    v_current_reports := v_reports::boolean;
    update private.rasika set season_reports = v_current_reports where id = v_rasika;
    insert into private.consent_event (rasika_id, purpose, value)
    values (v_rasika, 'season_reports', v_current_reports);
  end if;

  return jsonb_build_object('shareAdditions', v_current_share, 'seasonReports', v_current_reports);
end;
$$;

-- POST /v1/devices/claim: { deviceId, label } -> { writerDeviceId }. Makes this device the
-- writer (FR-022). Under the rasika's lock, so a push in flight finishes first.
create function public.devices_claim(jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_body jsonb := coalesce($1, '{}'::jsonb);
  v_rasika uuid := private.require_rasika();
  v_device text := v_body ->> 'deviceId';
  v_label text := coalesce(v_body ->> 'label', '');
begin
  if not pg_input_is_valid(coalesce(v_device, ''), 'uuid') then
    perform private.bad_request('deviceId must be a uuid');
  end if;

  perform private.lock_rasika(v_rasika);
  insert into private.device (rasika_id, id, label)
  values (v_rasika, v_device::uuid, left(v_label, 200))
  on conflict (rasika_id, id) do update set
    label = excluded.label,
    last_seen_at = now();
  update private.rasika set writer_device_id = v_device::uuid where id = v_rasika;

  return jsonb_build_object('writerDeviceId', v_device::uuid);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------

revoke all on function
  public.sync_push(jsonb),
  public.sync_pull(jsonb),
  public.me(),
  public.me_consent(jsonb),
  public.devices_claim(jsonb),
  private.raise_http(integer, text, text, text),
  private.version_at_least(text, text),
  private.check_request(),
  private.require_rasika(),
  private.lock_rasika(uuid),
  private.bad_request(text),
  private.owned_by_another(text, uuid),
  private.apply_op(uuid, jsonb, bigint)
from public, anon, service_role;

grant execute on function
  public.sync_push(jsonb),
  public.sync_pull(jsonb),
  public.me(),
  public.me_consent(jsonb),
  public.devices_claim(jsonb),
  private.raise_http(integer, text, text, text),
  private.version_at_least(text, text),
  private.check_request(),
  private.require_rasika(),
  private.lock_rasika(uuid),
  private.bad_request(text),
  private.owned_by_another(text, uuid),
  private.apply_op(uuid, jsonb, bigint)
to authenticated;

-- Run the version check before every API request, and tell PostgREST to pick it up.
alter role authenticator set pgrst.db_pre_request = 'private.check_request';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
