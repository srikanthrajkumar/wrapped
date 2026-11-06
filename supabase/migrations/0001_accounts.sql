-- Accounts: the rasika, consent events, devices and processed ops (T070; data-model.md,
-- "Server-only records").
--
-- Every table lives in the `private` schema, which the Data API does not expose
-- (config.toml `api.schemas`). The phone reaches them only through the functions in
-- 0004_sync.sql, which run as the caller, so row-level security below still limits each
-- rasika to their own rows inside them. A direct table write through the API would skip the
-- writer check, `seq` and `processed_op`; keeping the tables unexposed rules that out.

-- No function is callable by everyone by default: each one is granted explicitly.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;

create schema private;
revoke all on schema private from public;
-- Signed-in rasikas need the schema for the functions that run as them; nothing else does.
grant usage on schema private to authenticated;

-- A rasika. `id` is opaque and survives de-identification; it is not the Supabase user id.
create table private.rasika (
  id uuid primary key default gen_random_uuid(),
  -- Nulled on a deletion request (T076), which also deletes the auth user.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text,
  name text,
  -- Null until answered; nothing pre-selected (FR-042, FR-049).
  share_additions boolean,
  season_reports boolean,
  -- The current writing device (FR-022), set only by devices_claim.
  writer_device_id uuid,
  created_at timestamptz not null default now(),
  deidentified_at timestamptz
);

comment on table private.rasika is 'One per Supabase Auth user, created on first sign-in (data-model.md, "Rasika").';

-- Append-only record of every consent change, kept at least a year (DPDP Rules). It points
-- only at the opaque rasika id, so it survives de-identification.
create table private.consent_event (
  id bigint generated always as identity primary key,
  rasika_id uuid not null references private.rasika (id),
  purpose text not null check (purpose in ('share_additions', 'season_reports')),
  value boolean not null,
  at timestamptz not null default now()
);

create index consent_event_rasika_id_idx on private.consent_event (rasika_id);

-- A phone or tablet a rasika has used. The id is made on the device, so it is unique only
-- within one rasika.
create table private.device (
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  id uuid not null,
  label text not null default '' check (char_length(label) <= 200),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (rasika_id, id)
);

-- Every op a push has handled, acked or rejected (FR-015). The answer is kept with it, so a
-- retried push gets the same answer and nothing is applied twice.
create table private.processed_op (
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  op_id uuid not null,
  received_at timestamptz not null default now(),
  -- An acked op: the record's seq after it.
  seq bigint,
  -- A rejected op: its code and message.
  code text,
  message text,
  -- An acked op's record, and the record's seq before the run of this device's own writes the
  -- op belongs to (its seq before the op, or before the first op on it in the same push). A
  -- replayed ack counts as an earlier op in the push only while the record's seq is still
  -- this op's (0004_sync.sql, sync_push).
  record_table text,
  record_id uuid,
  chain_start_seq bigint,
  primary key (rasika_id, op_id),
  constraint processed_op_acked_or_rejected check ((seq is null) <> (code is null)),
  constraint processed_op_acked_record check (
    seq is null
    or (record_table is not null and record_id is not null and chain_start_seq is not null)
  )
);

-- The signed-in caller's rasika id, or null. Runs as the caller: the rasika policy below
-- lets them see only their own row.
create function private.current_rasika_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id from private.rasika r where r.auth_user_id = (select auth.uid())
$$;

grant execute on function private.current_rasika_id() to authenticated;

-- Row-level security on every table: a rasika sees and changes only their own rows.
alter table private.rasika enable row level security;
alter table private.consent_event enable row level security;
alter table private.device enable row level security;
alter table private.processed_op enable row level security;

create policy rasika_own_select on private.rasika
  for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy rasika_own_update on private.rasika
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy consent_event_own_select on private.consent_event
  for select to authenticated
  using (rasika_id = (select private.current_rasika_id()));
create policy consent_event_own_insert on private.consent_event
  for insert to authenticated
  with check (rasika_id = (select private.current_rasika_id()));

create policy device_own_select on private.device
  for select to authenticated
  using (rasika_id = (select private.current_rasika_id()));
create policy device_own_insert on private.device
  for insert to authenticated
  with check (rasika_id = (select private.current_rasika_id()));
create policy device_own_update on private.device
  for update to authenticated
  using (rasika_id = (select private.current_rasika_id()))
  with check (rasika_id = (select private.current_rasika_id()));

create policy processed_op_own_select on private.processed_op
  for select to authenticated
  using (rasika_id = (select private.current_rasika_id()));
create policy processed_op_own_insert on private.processed_op
  for insert to authenticated
  with check (rasika_id = (select private.current_rasika_id()));

-- Grants are the narrowest the functions need. A rasika may change only their consents and
-- writer; identity columns are written by the sign-in trigger and the deletion path alone.
-- Consent events and processed ops are never updated or deleted by a rasika.
grant select on private.rasika to authenticated;
grant update (share_additions, season_reports, writer_device_id) on private.rasika to authenticated;
grant select, insert on private.consent_event to authenticated;
grant select, insert on private.device to authenticated;
grant update (label, last_seen_at) on private.device to authenticated;
grant select, insert on private.processed_op to authenticated;

-- The first Supabase Auth sign-in creates the Rasika row (FR-021). Supabase Auth inserts the
-- user, so this runs as the table owner; it reads only the new user's own row.
create function private.create_rasika_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.rasika (auth_user_id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

revoke execute on function private.create_rasika_for_new_user() from public, anon, authenticated, service_role;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_rasika_for_new_user();
