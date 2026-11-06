-- The season: the five rasika-owned tables a phone pushes (T071; data-model.md,
-- "Rasika-owned records").
--
-- Each record is stored as one jsonb `data` column, exactly as the phone sent it. Its fields
-- are defined only in app/src/model/records.ts (eng review D7). The server keeps only the
-- bookkeeping it needs: the owner, the sync `seq`, the tombstone time, when it arrived and,
-- for appearances and items, the parent Event. Table names match the contract's table names
-- (`events`, `items`, …), so push and pull map an op's `table` straight to its table.
--
-- Ids are the phone's `crypto.randomUUID()` (constitution II), so the primary keys are random
-- UUIDs. A season is a few thousand rows, far below where that fragments an index.

-- One sequence for every rasika-owned row and Link. Push takes it under the rasika's lock, so a
-- rasika's rows commit in `seq` order and pull can page by it (contracts/sync-api.md, "Pull").
create sequence private.season_seq as bigint;
grant usage on sequence private.season_seq to authenticated;

create table private.events (
  id uuid primary key,
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  seq bigint not null,
  deleted_at timestamptz,
  received_at timestamptz not null default now(),
  data jsonb not null,
  -- The target of the appearances' and items' parent key, which pins a child to its owner's
  -- Events.
  constraint events_rasika_id_id_key unique (rasika_id, id)
);

create table private.appearances (
  id uuid primary key,
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  seq bigint not null,
  deleted_at timestamptz,
  received_at timestamptz not null default now(),
  event_id uuid not null,
  data jsonb not null,
  constraint appearances_event_fkey foreign key (rasika_id, event_id)
    references private.events (rasika_id, id) on delete cascade
);

create table private.items (
  id uuid primary key,
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  seq bigint not null,
  deleted_at timestamptz,
  received_at timestamptz not null default now(),
  event_id uuid not null,
  data jsonb not null,
  constraint items_event_fkey foreign key (rasika_id, event_id)
    references private.events (rasika_id, id) on delete cascade
);

create table private.artists (
  id uuid primary key,
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  seq bigint not null,
  deleted_at timestamptz,
  received_at timestamptz not null default now(),
  data jsonb not null
);

create table private.sabhas (
  id uuid primary key,
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  seq bigint not null,
  deleted_at timestamptz,
  received_at timestamptz not null default now(),
  data jsonb not null
);

-- Pull reads a rasika's rows in `seq` order; these indexes also serve the rasika_id key.
create index events_rasika_id_seq_idx on private.events (rasika_id, seq);
create index appearances_rasika_id_seq_idx on private.appearances (rasika_id, seq);
create index items_rasika_id_seq_idx on private.items (rasika_id, seq);
create index artists_rasika_id_seq_idx on private.artists (rasika_id, seq);
create index sabhas_rasika_id_seq_idx on private.sabhas (rasika_id, seq);
-- The parent keys, for the cascade when a season is deleted (T076).
create index appearances_rasika_id_event_id_idx on private.appearances (rasika_id, event_id);
create index items_rasika_id_event_id_idx on private.items (rasika_id, event_id);

-- Row-level security: each rasika reads and writes only their own rows. Nothing is deleted
-- by a rasika; a delete is a tombstone (outside voice 8).
do $$
declare
  t text;
begin
  foreach t in array array['events', 'appearances', 'items', 'artists', 'sabhas'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format(
      'create policy %I on private.%I for select to authenticated
         using (rasika_id = (select private.current_rasika_id()))',
      t || '_own_select', t);
    execute format(
      'create policy %I on private.%I for insert to authenticated
         with check (rasika_id = (select private.current_rasika_id()))',
      t || '_own_insert', t);
    execute format(
      'create policy %I on private.%I for update to authenticated
         using (rasika_id = (select private.current_rasika_id()))
         with check (rasika_id = (select private.current_rasika_id()))',
      t || '_own_update', t);
    execute format('grant select, insert, update on private.%I to authenticated', t);
  end loop;
end;
$$;
