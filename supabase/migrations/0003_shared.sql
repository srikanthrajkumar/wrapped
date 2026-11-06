-- The shared lists, Links and the Maintainer allowlist (T072; data-model.md, "Shared and
-- server-written records").

-- Shared Artists and Sabhas, curated by the Maintainer and pulled by every rasika, never
-- pushed. `list_version` is one counter across both tables: every change sets the entry's
-- version above every other, under the single shared-lists lock, so pull can page both by
-- (list_version, id) (contracts/sync-api.md, "Pull").
create table private.shared_artist (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 200),
  aliases text[] not null default '{}',
  list_version bigint not null check (list_version > 0)
);

create table private.shared_sabha (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 200),
  aliases text[] not null default '{}',
  list_version bigint not null check (list_version > 0)
);

create index shared_artist_list_version_id_idx on private.shared_artist (list_version, id);
create index shared_sabha_list_version_id_idx on private.shared_sabha (list_version, id);

-- A Link, written by the server when the Maintainer promotes an own entry (FR-044). The
-- rasika's own row is never changed, which keeps last-write-wins safe (ADR 0005). It takes a
-- `seq` from the season sequence under the rasika's lock, so it pulls with their own rows.
create table private.link (
  id uuid primary key default gen_random_uuid(),
  rasika_id uuid not null references private.rasika (id) on delete cascade,
  seq bigint not null,
  own_table text not null check (own_table in ('artist', 'sabha', 'event')),
  own_id uuid not null,
  -- A Shared Artist or Sabha id, or a Schedule entry id for an Event.
  shared_id text not null check (char_length(shared_id) between 1 and 200),
  created_at timestamptz not null default now(),
  constraint link_one_per_own_record unique (rasika_id, own_table, own_id)
);

create index link_rasika_id_seq_idx on private.link (rasika_id, seq);

-- The Maintainer's Supabase users. Rows are added by hand on the server and never committed
-- (CONTRIBUTING.md, "Secrets"). Nothing here is readable by a rasika.
create table private.maintainer (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table private.shared_artist enable row level security;
alter table private.shared_sabha enable row level security;
alter table private.link enable row level security;
alter table private.maintainer enable row level security;

-- Every signed-in rasika reads the shared lists; only the Maintainer's functions write them.
create policy shared_artist_read on private.shared_artist
  for select to authenticated
  using (true);
create policy shared_sabha_read on private.shared_sabha
  for select to authenticated
  using (true);
-- A rasika reads only their own Links.
create policy link_own_select on private.link
  for select to authenticated
  using (rasika_id = (select private.current_rasika_id()));
-- private.maintainer has no policy and no grant: no rasika can read it.

grant select on private.shared_artist, private.shared_sabha, private.link to authenticated;
