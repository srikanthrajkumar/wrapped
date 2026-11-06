-- De-identification on a deletion request (T076; data-model.md, "Deletion and
-- de-identification"; FR-047). The Maintainer calls `admin_deletion` with the email the
-- rasika wrote from; in one transaction, under the rasika's lock:
--
--   1. the Supabase Auth user is deleted, which ends its sessions and refresh tokens;
--   2. the rasika row loses its auth user, email and name, gets `deidentified_at`, and its
--      devices and writer are dropped;
--   3. every note in the season is nulled: each Event's and Item's `note` and each Item's
--      `layaVinyasam.note`, inside `data` (app/src/model/records.ts);
--   4. Supabase Auth's own audit log loses every entry naming the auth user or the email;
--   5. the processed ops go, since no device of theirs can push again;
--   6. unless `season_reports` is true, the season is deleted, Links included.
--
-- Everything else in a kept season stays as sent: own Artist and Sabha names, titles and typed
-- Detail values are what season reports count (data-model.md, "Deletion and de-identification").
-- Consent events stay: they point only at the opaque rasika id and are kept at least a year
-- (DPDP Rules; data-model.md, "Consent event").

-- Whether the caller is on the Maintainer allowlist. Runs as the owner because no rasika may
-- read private.maintainer.
create function private.is_maintainer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.maintainer m where m.auth_user_id = (select auth.uid())
  )
$$;

-- The work itself. Runs as the owner: it deletes an auth user and changes another rasika's
-- rows. It checks the allowlist itself, so it is safe even if called some other way.
create function private.deidentify(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_rasika record;
  v_season_reports boolean;
  v_found boolean := false;
begin
  if not private.is_maintainer() then
    perform private.raise_http(403, 'not_maintainer', 'Only the Maintainer may do this');
  end if;
  if v_email is null or v_email = '' then
    perform private.bad_request('email is required');
  end if;

  -- The rasika by their auth user's email or, if the auth user is already gone, by the email
  -- still on the rasika row. Already de-identified rasikas match neither, so a second request
  -- for the same email changes nothing.
  for v_rasika in
    select r.id, r.auth_user_id, lower(u.email) as auth_email
    from private.rasika r
    left join auth.users u on u.id = r.auth_user_id
    where r.deidentified_at is null
      and (lower(u.email) = v_email or lower(r.email) = v_email)
    order by r.id
  loop
    v_found := true;
    perform private.lock_rasika(v_rasika.id);
    -- Read again under the lock, so a consent change that was in flight is counted.
    select r.season_reports into v_season_reports from private.rasika r where r.id = v_rasika.id;

    -- 1. The auth user, its sessions, refresh tokens and identities.
    if v_rasika.auth_user_id is not null then
      delete from auth.users u where u.id = v_rasika.auth_user_id;
    end if;

    -- 2. Identity on the rasika row, and the devices.
    update private.rasika r set
      auth_user_id = null,
      email = null,
      name = null,
      writer_device_id = null,
      deidentified_at = now()
    where r.id = v_rasika.id;
    delete from private.device d where d.rasika_id = v_rasika.id;

    -- 3. Every note, which is free text and can identify them.
    update private.events e set
      data = e.data || jsonb_build_object('note', null)
    where e.rasika_id = v_rasika.id and e.data ? 'note';
    update private.items i set
      data = case
        when jsonb_typeof(i.data -> 'layaVinyasam') = 'object'
          then jsonb_set(i.data || jsonb_build_object('note', null), '{layaVinyasam,note}', 'null'::jsonb)
        else i.data || jsonb_build_object('note', null)
      end
    where i.rasika_id = v_rasika.id;

    -- 4. Supabase Auth's audit log, which names the user by id and email, and by Google name
    -- beside the id. The fields are matched exactly, so a similar email is never caught.
    delete from auth.audit_log_entries x
    where x.payload ->> 'actor_id' = v_rasika.auth_user_id::text
      or x.payload -> 'traits' ->> 'user_id' = v_rasika.auth_user_id::text
      or lower(x.payload ->> 'actor_username') in (v_email, v_rasika.auth_email)
      or lower(x.payload -> 'traits' ->> 'user_email') in (v_email, v_rasika.auth_email);

    -- 5. The processed ops: no device of theirs can push again, so no retry needs them.
    delete from private.processed_op p where p.rasika_id = v_rasika.id;

    -- 6. The season, unless they said yes to season reports (FR-049).
    if v_season_reports is not true then
      delete from private.link l where l.rasika_id = v_rasika.id;
      delete from private.appearances a where a.rasika_id = v_rasika.id;
      delete from private.items i where i.rasika_id = v_rasika.id;
      delete from private.events e where e.rasika_id = v_rasika.id;
      delete from private.artists a where a.rasika_id = v_rasika.id;
      delete from private.sabhas s where s.rasika_id = v_rasika.id;
    end if;
  end loop;

  return v_found;
end;
$$;

-- POST /v1/admin/deletion: { email } -> { deidentified } (contracts/sync-api.md,
-- "Maintainer"). `deidentified` is false when no account matched, as on a repeat; nothing
-- else about the rasika is returned (FR-042).
create function public.admin_deletion(jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_body jsonb := coalesce($1, '{}'::jsonb);
begin
  -- The allowlist first, so a rasika learns nothing from the body's checks.
  if not private.is_maintainer() then
    perform private.raise_http(403, 'not_maintainer', 'Only the Maintainer may do this');
  end if;
  if jsonb_typeof(v_body -> 'email') is distinct from 'string' then
    perform private.bad_request('email is required');
  end if;
  return jsonb_build_object('deidentified', private.deidentify(v_body ->> 'email'));
end;
$$;

revoke all on function
  private.is_maintainer(),
  private.deidentify(text),
  public.admin_deletion(jsonb)
from public, anon, service_role;

grant execute on function
  private.is_maintainer(),
  private.deidentify(text),
  public.admin_deletion(jsonb)
to authenticated;

notify pgrst, 'reload schema';
