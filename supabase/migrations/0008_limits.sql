-- Limits, revocation and tombstone notes (T109, the security review of 2026-11-27).
--
-- 1. Limits on what one rasika can store (outside voice 18). The Free plan's database holds
--    500 MB (ADR 0014); without limits one signed-in account could fill it, and Supabase then
--    restricts the project for every rasika. Each limit is a column of private.server_config, so
--    the Maintainer can change it by hand without a migration:
--    - a pushed row of more than `max_row_bytes` is rejected `invalid_op`, counted as its JSON
--      text without `deletedAt` and `updatedAt` (bounded on their own, below), so a plain delete
--      of a row at the limit still fits;
--    - a season is measured row by row with private.row_bytes, the same way for the total and
--      for each op, so an edit's change to the total is exactly what it adds or frees. A row
--      counts as its JSON text without `deletedAt` and `updatedAt`, plus a fixed 128 bytes that
--      cover both: each must be a timestamp of at most 42 bytes as JSON (or null), so the count
--      is never below the row's real size. A delete that only sets `deletedAt` (the server then
--      empties its notes) therefore never grows the season;
--    - an op that grows the season is rejected `invalid_op` unless it fits under
--      `max_season_bytes`. An op that doesn't grow it, a plain delete among them, is always
--      accepted, so a full season can always be tidied, and nothing takes it past the limit;
--    - ops the server hasn't handled count toward `max_ops_per_day` in 24 hours; a retried op
--      is answered from its processed op and never counts. A push stops at the first new op
--      past the limit: the ops before it are answered, and it and the rest are left unanswered,
--      so they stay queued on the phone. A push that could answer nothing gets 429
--      `too_many_ops` and applies nothing;
--    - processed ops are kept for good, as before (0004_sync.sql): a retry after a lost reply
--      needs them however long the phone was away. The day's op limit bounds how fast they
--      grow: at most 10,000 a day, about 2 MB with their indexes;
--    - more than `max_consent_changes_per_day` consent changes in 24 hours gets 429
--      `too_many_changes`, counting the changes the call would make;
--    - a rasika keeps their `max_devices` most recently seen devices; older ones are dropped
--      when another device claims.
--
-- 2. A revoked session stops at once. Supabase's access tokens are signed JWTs that stay valid
--    until they expire (an hour); "sign out other devices" only revokes their refresh tokens. So
--    every request whose token names a session that no longer exists gets 401 `session_ended`,
--    which the phone shows as "sign in again" (contracts/sync-api.md, "Errors"). A token whose
--    account was deleted is left to `require_rasika`, which answers 403 `no_account` as before.
--
-- 3. A deleted record keeps no note on the server. A delete is the full row with `deletedAt`
--    set (outside voice 8); the phone needs the rest of it (Undo, the schedule's reuse of a
--    deleted Appearance), but not the note, which is the free text that can identify a rasika.
--    The tombstone's notes are the ones de-identification clears (0005_deletion.sql): an
--    Event's and an Item's `note` and an Item's `layaVinyasam.note`. A note with text becomes
--    "", which is never longer than the text it replaces, so emptying it never grows the row; a
--    note that is already empty, null or absent is left as it is. The deleting phone keeps its
--    own copy, so its Undo still brings the note back.

-- ---------------------------------------------------------------------------------------------
-- The limits
-- ---------------------------------------------------------------------------------------------

alter table private.server_config
  add column max_row_bytes integer not null default 65536 check (max_row_bytes > 0),
  add column max_season_bytes bigint not null default 16777216 check (max_season_bytes > 0),
  add column max_ops_per_day integer not null default 10000 check (max_ops_per_day > 0),
  add column max_consent_changes_per_day integer not null default 50
    check (max_consent_changes_per_day > 0),
  add column max_devices integer not null default 20 check (max_devices > 0);

-- A row's size as the season counts it (above): its JSON text without the two timestamps, plus a
-- fixed 128 bytes for them. `, "deletedAt": ` and `, "updatedAt": ` take 30 bytes, and apply_op
-- lets each value take at most 42 bytes as JSON (a quoted ISO timestamp takes 26), so the count
-- is never below the real size.
create function private.row_bytes(p_data jsonb)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select octet_length((p_data - 'deletedAt' - 'updatedAt')::text) + 128
$$;

-- Kept by the database itself, so every write, including de-identification's
-- (0005_deletion.sql), keeps it right.
do $$
declare
  t text;
begin
  foreach t in array array['events', 'appearances', 'items', 'artists', 'sabhas'] loop
    execute format(
      'alter table private.%I add column data_bytes integer
         generated always as (private.row_bytes(data)) stored',
      t);
  end loop;
end;
$$;

-- The day's ops, found by when they arrived.
create index processed_op_rasika_id_received_at_idx
  on private.processed_op (rasika_id, received_at);
create index consent_event_rasika_id_at_idx on private.consent_event (rasika_id, at);

-- Drops the caller's devices past their most recently seen `max_devices`. A rasika may not
-- delete devices directly (0001_accounts.sql), so this runs as the owner; it takes no argument and
-- touches only the caller's own rows.
create function private.trim_devices()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_rasika_id();
  v_max integer;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select c.max_devices into v_max from private.server_config c;
  delete from private.device d
  where d.rasika_id = v_me
    and d.id not in (
      select k.id from private.device k
      where k.rasika_id = v_me
      order by k.last_seen_at desc, k.created_at desc
      limit v_max
    );
end;
$$;

-- The size of a rasika's season: their rows' JSON text, in bytes.
create function private.season_bytes(p_rasika uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(s.bytes), 0)::bigint from (
    select sum(t.data_bytes) as bytes from private.events t where t.rasika_id = p_rasika
    union all
    select sum(t.data_bytes) from private.appearances t where t.rasika_id = p_rasika
    union all
    select sum(t.data_bytes) from private.items t where t.rasika_id = p_rasika
    union all
    select sum(t.data_bytes) from private.artists t where t.rasika_id = p_rasika
    union all
    select sum(t.data_bytes) from private.sabhas t where t.rasika_id = p_rasika
  ) s
$$;

-- ---------------------------------------------------------------------------------------------
-- A revoked session
-- ---------------------------------------------------------------------------------------------

-- Whether the caller's own session still exists. Supabase Auth deletes a session when it is
-- signed out, including by "sign out other devices". Runs as the owner because no rasika may read
-- auth.sessions; it answers only for the caller's own user.
create function private.session_is_live(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = p_session
      and s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
  )
$$;

-- The pre-request check (0004_sync.sql), now also refusing a token whose session has ended.
create or replace function private.check_request()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_version text := current_setting('request.headers', true)::jsonb ->> 'x-app-version';
  v_session text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id';
  v_minimum text;
begin
  select c.min_app_version into v_minimum from private.server_config c;
  if not private.version_at_least(v_version, v_minimum) then
    perform private.raise_http(426, 'update_required', 'Update the app to keep syncing', v_minimum);
  end if;
  -- Only a token with a session and an account: a deleted account's token reaches
  -- require_rasika, which answers 403 `no_account`.
  if v_session is not null
    and private.current_rasika_id() is not null
    and (not pg_input_is_valid(v_session, 'uuid') or not private.session_is_live(v_session::uuid))
  then
    perform private.raise_http(401, 'session_ended', 'This sign-in has ended; sign in again');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Push
-- ---------------------------------------------------------------------------------------------

-- apply_op (0004_sync.sql) with the size limits and the tombstone's notes. `p_room` is how many
-- more bytes the season may grow by before `max_season_bytes`. `size_change` is how much the op
-- grew or shrank the season, measured by private.row_bytes.
drop function private.apply_op(uuid, jsonb, bigint);

create function private.apply_op(
  p_rasika uuid,
  p_op jsonb,
  p_push_start_seq bigint,
  p_room bigint,
  p_max_row_bytes integer,
  out seq bigint,
  out code text,
  out message text,
  out previous_seq bigint,
  out size_change bigint
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
  v_previous_bytes bigint;
begin
  -- The op's shape. The server checks only ids, owners and the parent Event (eng review D7).
  if v_table is null or v_table not in ('events', 'appearances', 'items', 'artists', 'sabhas') then
    code := 'invalid_op';
    message := format('Unknown table %s', left(coalesce(v_table, '(none)'), 40));
    return;
  end if;
  if jsonb_typeof(v_row) is distinct from 'object'
    or not pg_input_is_valid(coalesce(v_row ->> 'id', ''), 'uuid') then
    code := 'invalid_op';
    message := 'The row needs a uuid id';
    return;
  end if;
  if octet_length((v_row - 'deletedAt' - 'updatedAt')::text) > p_max_row_bytes then
    code := 'invalid_op';
    message := format('The row is larger than the server keeps (%s bytes)', p_max_row_bytes);
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
  -- The two timestamps the size count leaves out must be short (private.row_bytes).
  if (v_row ? 'updatedAt' and jsonb_typeof(v_row -> 'updatedAt') not in ('null', 'string'))
    or coalesce(octet_length((v_row -> 'deletedAt')::text), 0) > 42
    or coalesce(octet_length((v_row -> 'updatedAt')::text), 0) > 42
  then
    code := 'invalid_op';
    message := 'deletedAt and updatedAt must be timestamps';
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
  execute format('select t.seq, t.data_bytes from private.%I t where t.id = $1', v_table)
    into previous_seq, v_previous_bytes
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

  -- A tombstone keeps no note text (the notes 0005_deletion.sql clears, step 3). A note with
  -- text becomes "", never longer than what it replaces; an empty, null or absent one stays.
  if v_deleted_at is not null and v_table in ('events', 'items') then
    if jsonb_typeof(v_row -> 'note') = 'string' and v_row ->> 'note' <> '' then
      v_row := v_row || jsonb_build_object('note', '');
    end if;
    if v_table = 'items' and jsonb_typeof(v_row -> 'layaVinyasam') = 'object'
      and jsonb_typeof(v_row -> 'layaVinyasam' -> 'note') = 'string'
      and v_row -> 'layaVinyasam' ->> 'note' <> '' then
      v_row := jsonb_set(v_row, '{layaVinyasam,note}', '""'::jsonb);
    end if;
  end if;

  -- The season's size: an op that doesn't grow it, a plain delete among them, is always taken.
  -- One that does must fit in the room left, so nothing takes the season past the limit.
  size_change := private.row_bytes(v_row) - coalesce(v_previous_bytes, 0);
  if size_change > 0 and size_change > p_room then
    code := 'invalid_op';
    message := 'The season is larger than the server keeps; delete something first';
    size_change := null;
    return;
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

-- sync_push (0004_sync.sql) with the day's op limit, the season's size and the trimming.
create or replace function public.sync_push(jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_body jsonb := coalesce($1, '{}'::jsonb);
  v_rasika uuid := private.require_rasika();
  v_ops jsonb := v_body -> 'ops';
  v_device text := v_body ->> 'deviceId';
  v_config private.server_config;
  v_writer uuid;
  v_op jsonb;
  v_op_id uuid;
  v_table text;
  v_record_id text;
  v_key text;
  v_seq bigint;
  v_code text;
  v_message text;
  v_previous bigint;
  v_size_change bigint;
  v_record_table text;
  v_record_uuid uuid;
  v_chain_start bigint;
  v_current bigint;
  v_today integer;
  v_stopped boolean := false;
  v_season bigint;
  -- `<table>:<record id>` -> the record's seq before this device's run of writes to it, for
  -- every record an op of this push has written or whose replayed ack is still its latest
  -- write. An op on such a record may carry that seq as its baseSeq (sync rules (a)).
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

  select * into v_config from private.server_config;

  -- The day's ops, counted no further than the limit. Only ops handled for the first time
  -- count, below; a retried one is answered from its processed op.
  select count(*) into v_today from (
    select 1 from private.processed_op p
    where p.rasika_id = v_rasika and p.received_at > now() - interval '1 day'
    limit v_config.max_ops_per_day + 1
  ) d;

  v_season := private.season_bytes(v_rasika);

  for v_op in
    select e.value from jsonb_array_elements(v_ops) with ordinality as e (value, n) order by e.n
  loop
    if not pg_input_is_valid(coalesce(v_op ->> 'opId', ''), 'uuid') then
      perform private.bad_request('Every op needs a uuid opId');
    end if;
    v_op_id := (v_op ->> 'opId')::uuid;

    -- A repeated opId gets its first answer again and changes nothing (FR-015).
    select p.seq, p.code, p.message, p.record_table, p.record_id, p.chain_start_seq
    into v_seq, v_code, v_message, v_record_table, v_record_uuid, v_chain_start
    from private.processed_op p
    where p.rasika_id = v_rasika and p.op_id = v_op_id;

    if found then
      -- A replayed ack whose reply was lost: if nothing has written the record since, the
      -- phone's later ops on it were based on the same seq as this one, so it counts as an
      -- earlier op of this push. A write after it, such as another device's, ends that.
      if v_code is null then
        execute format('select t.seq from private.%I t where t.id = $1', v_record_table)
          into v_current
          using v_record_uuid;
        if v_current = v_seq then
          v_push_start := v_push_start
            || jsonb_build_object(v_record_table || ':' || v_record_uuid::text, v_chain_start);
        end if;
      end if;
    else
      -- A new op past the day's limit ends the push here: it and every op after it stay
      -- unanswered, so they stay queued, in order, on the phone.
      if v_today >= v_config.max_ops_per_day then
        v_stopped := true;
        exit;
      end if;
      v_today := v_today + 1;
      v_table := v_op ->> 'table';
      v_record_id := v_op #>> '{row,id}';
      v_key := case
        when pg_input_is_valid(coalesce(v_record_id, ''), 'uuid')
          then coalesce(v_table, '') || ':' || v_record_id::uuid::text
      end;
      select a.seq, a.code, a.message, a.previous_seq, a.size_change
      into v_seq, v_code, v_message, v_previous, v_size_change
      from private.apply_op(
        v_rasika,
        v_op,
        (v_push_start ->> v_key)::bigint,
        v_config.max_season_bytes - v_season,
        v_config.max_row_bytes
      ) a;

      if v_code is null then
        v_season := v_season + v_size_change;
        v_chain_start := coalesce((v_push_start ->> v_key)::bigint, v_previous);
        if not v_push_start ? v_key then
          v_push_start := v_push_start || jsonb_build_object(v_key, v_previous);
        end if;
        insert into private.processed_op
          (rasika_id, op_id, seq, record_table, record_id, chain_start_seq)
        values (v_rasika, v_op_id, v_seq, v_table, v_record_id::uuid, v_chain_start);
      else
        insert into private.processed_op (rasika_id, op_id, code, message)
        values (v_rasika, v_op_id, v_code, v_message);
      end if;
    end if;

    if v_code is null then
      v_acked := v_acked || jsonb_build_array(jsonb_build_object('opId', v_op_id, 'seq', v_seq));
    else
      v_rejected := v_rejected
        || jsonb_build_array(jsonb_build_object('opId', v_op_id, 'code', v_code, 'message', v_message));
    end if;
  end loop;

  if v_stopped and v_acked = '[]'::jsonb and v_rejected = '[]'::jsonb then
    perform private.raise_http(
      429, 'too_many_ops', 'Too many changes in a day; the rest sync tomorrow',
      v_config.max_ops_per_day::text
    );
  end if;

  return jsonb_build_object('acked', v_acked, 'rejected', v_rejected);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Consent and devices
-- ---------------------------------------------------------------------------------------------

-- me_consent (0004_sync.sql) with the day's limit on changes.
create or replace function public.me_consent(jsonb)
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
  v_limit integer;
  v_today integer;
  v_changes integer;
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

  -- The day's changes and the ones this call would make must fit under the limit. A call that
  -- changes nothing is always accepted.
  v_changes :=
    (v_share is not null and v_current_share is distinct from (v_share::boolean))::integer
    + (v_reports is not null and v_current_reports is distinct from (v_reports::boolean))::integer;
  if v_changes > 0 then
    select c.max_consent_changes_per_day into v_limit from private.server_config c;
    select count(*) into v_today from (
      select 1 from private.consent_event e
      where e.rasika_id = v_rasika and e.at > now() - interval '1 day'
      limit v_limit + 1
    ) d;
    if v_today + v_changes > v_limit then
      perform private.raise_http(
        429, 'too_many_changes', 'Too many consent changes in a day; try again tomorrow',
        v_limit::text
      );
    end if;
  end if;

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

-- devices_claim (0004_sync.sql), now keeping only the most recently seen devices.
create or replace function public.devices_claim(jsonb)
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
  perform private.trim_devices();

  return jsonb_build_object('writerDeviceId', v_device::uuid);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------

revoke all on function
  private.row_bytes(jsonb),
  private.trim_devices(),
  private.season_bytes(uuid),
  private.session_is_live(uuid),
  private.apply_op(uuid, jsonb, bigint, bigint, integer)
from public, anon, service_role;

grant execute on function
  private.row_bytes(jsonb),
  private.trim_devices(),
  private.season_bytes(uuid),
  private.session_is_live(uuid),
  private.apply_op(uuid, jsonb, bigint, bigint, integer)
to authenticated;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
