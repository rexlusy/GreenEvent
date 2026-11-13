begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  role text not null default 'participant' check (role in ('participant', 'organizer'))
);

create function public.ge_profile_on_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    case when char_length(trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))) >= 2
      then left(trim(new.raw_user_meta_data ->> 'full_name'), 100)
      else 'Peserta GreenEvent' end
  );
  return new;
end;
$$;
revoke all on function public.ge_profile_on_signup() from public, anon, authenticated;
create trigger greenevent_create_profile after insert on auth.users
for each row execute function public.ge_profile_on_signup();

-- Create profiles for users who already existed when the migration was applied.
insert into public.profiles (id, full_name)
select id, 'Peserta GreenEvent' from auth.users on conflict (id) do nothing;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  organizer_name text not null,
  title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null check (char_length(trim(description)) between 10 and 1600),
  category text not null check (category in ('Workshop', 'Seminar', 'Komunitas', 'Lainnya')),
  venue text not null check (char_length(trim(venue)) between 2 and 120),
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 10000),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  is_demo boolean not null default false
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (event_id, participant_id)
);

create table public.attendance_windows (
  event_id uuid primary key references public.events(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  opens_at timestamptz not null,
  closes_at timestamptz not null check (closes_at > opens_at)
);

create table public.attendances (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  method text not null check (method in ('qr', 'manual')),
  note text,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  check (method <> 'manual' or (note is not null and char_length(trim(note)) between 3 and 300)),
  check ((approved_at is null) = (approved_by is null))
);

create table public.certificates (
  registration_id uuid primary key references public.attendances(registration_id) on delete cascade,
  code text not null unique default ('GE-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  issued_at timestamptz not null default now(),
  participant_name text not null,
  event_title text not null,
  event_date timestamptz not null,
  organizer_name text not null
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  scenario text not null check (scenario in ('A', 'B')),
  kind text not null check (kind in ('paper', 'digital')),
  label text not null check (char_length(trim(label)) between 2 and 100),
  quantity bigint not null check (quantity >= 0),
  area_m2 numeric,
  grammage_g_m2 numeric,
  paper_factor numeric,
  frequency integer,
  source text not null check (char_length(trim(source)) between 2 and 250),
  check (
    (kind = 'paper' and quantity <= 10000000 and area_m2 is not null and area_m2 between 0.0001 and 10
      and grammage_g_m2 is not null and grammage_g_m2 between 1 and 1000
      and paper_factor is not null and paper_factor between 0.0001 and 1000 and frequency is null)
    or
    (kind = 'digital' and quantity <= 10000000000 and frequency is not null and frequency between 1 and 10000000
      and area_m2 is null and grammage_g_m2 is null and paper_factor is null)
  )
);

create index events_agenda on public.events (starts_at, id) where status <> 'draft';
create index events_organizer on public.events (organizer_id, starts_at desc, id);
create index registrations_roster on public.registrations (event_id, registered_at, id);
create index registrations_mine on public.registrations (participant_id, registered_at desc, id);
create index measurements_by_event on public.measurements (event_id, scenario, kind, id);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.attendance_windows enable row level security;
alter table public.attendances enable row level security;
alter table public.certificates enable row level security;
alter table public.measurements enable row level security;

revoke all on table public.profiles, public.events, public.registrations, public.attendance_windows,
  public.attendances, public.certificates, public.measurements from public, anon, authenticated;
grant select on table public.events to anon, authenticated;
grant select on table public.profiles, public.registrations, public.attendance_windows,
  public.attendances, public.certificates, public.measurements to authenticated;
grant select, insert, update, delete on table public.profiles, public.events, public.registrations,
  public.attendance_windows, public.attendances, public.certificates, public.measurements to service_role;

create policy profiles_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy events_public_or_own on public.events for select to anon, authenticated
using (status <> 'draft' or organizer_id = (select auth.uid()));
create policy registrations_own on public.registrations for select to authenticated
using (participant_id = (select auth.uid()));
create policy windows_organizer on public.attendance_windows for select to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()))
);
create policy attendances_own on public.attendances for select to authenticated using (
  exists (select 1 from public.registrations r where r.id = registration_id and r.participant_id = (select auth.uid()))
);
create policy certificates_own on public.certificates for select to authenticated using (
  exists (select 1 from public.registrations r where r.id = registration_id and r.participant_id = (select auth.uid()))
);
create policy measurements_organizer on public.measurements for select to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()))
);

create function public.ge_require_role(p_role text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null or not exists (
    select 1 from public.profiles p where p.id = v_id and p.role = p_role
  ) then
    raise exception using message = 'Peran akun ini tidak memiliki akses.', errcode = '42501';
  end if;
  return v_id;
end;
$$;

create function public.ge_require_owner(p_event uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.ge_require_role('organizer');
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v_id) then
    raise exception using message = 'Kegiatan tidak ditemukan.', errcode = '42501';
  end if;
  return v_id;
end;
$$;

create function public.ge_save_event(
  p_event uuid, p_title text, p_description text, p_category text, p_venue text,
  p_starts_at timestamptz, p_capacity integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.ge_require_role('organizer');
  v_event uuid;
begin
  if p_event is null then
    insert into public.events (organizer_id, organizer_name, title, description, category, venue, starts_at, capacity)
    select v_owner, p.full_name, trim(p_title), trim(p_description), p_category, trim(p_venue), p_starts_at, p_capacity
    from public.profiles p where p.id = v_owner returning id into v_event;
    return v_event;
  end if;

  -- Lock the event before checking capacity. Registration uses the same lock.
  perform 1 from public.events where id = p_event and organizer_id = v_owner for update;
  if not found then
    raise exception using message = 'Kegiatan tidak ditemukan.', errcode = '42501';
  end if;
  if p_capacity < (select count(*) from public.registrations where event_id = p_event) then
    raise exception 'Kuota harus mencakup semua peserta yang sudah mendaftar.';
  end if;
  update public.events set title = trim(p_title), description = trim(p_description), category = p_category,
    venue = trim(p_venue), starts_at = p_starts_at, capacity = p_capacity where id = p_event;
  return p_event;
end;
$$;

create function public.ge_registration_status(p_event uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.ge_require_owner(p_event);
begin
  if p_status is null or p_status not in ('open', 'closed') then
    raise exception 'Status pendaftaran tidak valid.';
  end if;
  update public.events set status = p_status where id = p_event and organizer_id = v_owner
    and (status <> 'draft' or p_status = 'open');
  if not found then
    raise exception 'Terbitkan kegiatan sebelum menutup pendaftaran.';
  end if;
end;
$$;

create function public.ge_register(p_event uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid := public.ge_require_role('participant');
  v_event public.events;
begin
  select e.* into v_event from public.events e where e.id = p_event and e.status <> 'draft' for update;
  if not found then
    raise exception 'Kegiatan belum dipublikasikan.';
  end if;
  if exists (select 1 from public.registrations where event_id = p_event and participant_id = v_participant) then
    return 'existing';
  end if;
  if v_event.status <> 'open' then
    raise exception 'Pendaftaran kegiatan ini sudah ditutup.';
  end if;
  if (select count(*) from public.registrations where event_id = p_event) >= v_event.capacity then
    raise exception 'Kuota kegiatan sudah penuh.';
  end if;
  insert into public.registrations (event_id, participant_id) values (p_event, v_participant);
  return 'registered';
end;
$$;

create function public.ge_set_window(p_event uuid, p_open timestamptz, p_close timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ge_require_owner(p_event);
  if not exists (select 1 from public.events where id = p_event and status <> 'draft') then
    raise exception 'Publikasikan kegiatan sebelum membuka presensi.';
  end if;
  if p_open is null and p_close is null then
    delete from public.attendance_windows where event_id = p_event;
    return;
  end if;
  if p_open is null or p_close is null or p_close <= p_open or p_close <= now() then
    raise exception 'Akhir presensi harus setelah waktu mulai dan masih akan datang.';
  end if;
  insert into public.attendance_windows (event_id, opens_at, closes_at)
  values (p_event, p_open, p_close)
  on conflict (event_id) do update set opens_at = excluded.opens_at,
    closes_at = excluded.closes_at, token = excluded.token;
end;
$$;

create function public.ge_checkin_info(p_token uuid)
returns table (event_id uuid, title text, closes_at timestamptz, recorded_at timestamptz, approved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := public.ge_require_role('participant');
  v_window public.attendance_windows;
begin
  select w.* into v_window from public.attendance_windows w where w.token = p_token;
  if not found or now() < v_window.opens_at or now() >= v_window.closes_at then
    raise exception 'Tautan presensi belum aktif, sudah berakhir, atau telah diganti.';
  end if;
  return query
  select e.id, e.title, v_window.closes_at, a.recorded_at, a.approved_at
  from public.events e
  join public.registrations r on r.event_id = e.id and r.participant_id = v_user
  left join public.attendances a on a.registration_id = r.id
  where e.id = v_window.event_id;
  if not found then
    raise exception 'Daftar pada kegiatan ini sebelum mencatat presensi.';
  end if;
end;
$$;

create function public.ge_checkin(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public.ge_require_role('participant');
  v_window public.attendance_windows;
  v_registration uuid;
begin
  select w.* into v_window from public.attendance_windows w where w.token = p_token for share;
  if not found or clock_timestamp() < v_window.opens_at or clock_timestamp() >= v_window.closes_at then
    raise exception 'Tautan presensi belum aktif, sudah berakhir, atau telah diganti.';
  end if;
  select r.id into v_registration from public.registrations r
  where r.event_id = v_window.event_id and r.participant_id = v_user;
  if not found then
    raise exception 'Daftar pada kegiatan ini sebelum mencatat presensi.';
  end if;
  insert into public.attendances (registration_id, method) values (v_registration, 'qr')
  on conflict (registration_id) do nothing;
  return v_window.event_id;
end;
$$;

create function public.ge_attendance_action(p_event uuid, p_registration uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.ge_require_owner(p_event);
begin
  perform 1 from public.registrations where id = p_registration and event_id = p_event for no key update;
  if not found then
    raise exception using message = 'Pendaftaran tidak ditemukan.', errcode = '42501';
  end if;
  if p_action = 'manual' then
    if p_note is null or char_length(trim(p_note)) not between 3 and 300 then
      raise exception 'Tulis alasan koreksi presensi sepanjang 3–300 karakter.';
    end if;
    insert into public.attendances (registration_id, method, note) values (p_registration, 'manual', trim(p_note))
    on conflict (registration_id) do nothing;
  elsif p_action = 'approve' then
    update public.attendances set approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, v_owner) where registration_id = p_registration;
    if not found then
      raise exception 'Catat presensi sebelum mengesahkan kehadiran.';
    end if;
  elsif p_action = 'issue' then
    if not exists (select 1 from public.attendances where registration_id = p_registration and approved_at is not null) then
      raise exception 'Sahkan kehadiran sebelum menerbitkan sertifikat.';
    end if;
    insert into public.certificates (registration_id, participant_name, event_title, event_date, organizer_name)
    select r.id, p.full_name, e.title, e.starts_at, e.organizer_name
    from public.registrations r join public.profiles p on p.id = r.participant_id
    join public.events e on e.id = r.event_id where r.id = p_registration
    on conflict (registration_id) do nothing;
  else
    raise exception 'Aksi kehadiran tidak valid.';
  end if;
end;
$$;

create function public.ge_agenda(p_query text, p_category text, p_offset integer)
returns table (
  id uuid, title text, category text, venue text, starts_at timestamptz,
  capacity integer, status text, is_demo boolean, registered bigint
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.category, e.venue, e.starts_at, e.capacity, e.status, e.is_demo,
    (select count(*) from public.registrations r where r.event_id = e.id)
  from public.events e
  where e.status <> 'draft' and e.starts_at >= now() - interval '1 day'
    and (nullif(p_category, '') is null or e.category = p_category)
    and strpos(lower(e.title || ' ' || e.venue), lower(left(coalesce(p_query, ''), 100))) > 0
  order by e.starts_at, e.id limit 10 offset greatest(0, least(coalesce(p_offset, 0), 9000));
$$;

create function public.ge_registered_count(p_event uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.registrations r join public.events e on e.id = r.event_id
  where r.event_id = p_event and (e.status <> 'draft' or e.organizer_id = auth.uid());
$$;

create function public.ge_event_stats(p_event uuid)
returns table (registered bigint, checked_in bigint, approved bigint, issued bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ge_require_owner(p_event);
  return query
    select count(r.id), count(a.registration_id), count(a.approved_at), count(c.registration_id)
    from public.registrations r
    left join public.attendances a on a.registration_id = r.id
    left join public.certificates c on c.registration_id = r.id
    where r.event_id = p_event;
end;
$$;

create function public.ge_roster(p_event uuid, p_offset integer, p_limit integer)
returns table (
  id uuid, full_name text, email text, registered_at timestamptz, recorded_at timestamptz,
  method text, note text, approved_at timestamptz, certificate_code text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ge_require_owner(p_event);
  return query
    select r.id, p.full_name, u.email::text, r.registered_at, a.recorded_at, a.method,
      a.note, a.approved_at, c.code
    from public.registrations r
    join public.profiles p on p.id = r.participant_id join auth.users u on u.id = p.id
    left join public.attendances a on a.registration_id = r.id
    left join public.certificates c on c.registration_id = r.id
    where r.event_id = p_event order by r.registered_at, r.id
    limit greatest(1, least(coalesce(p_limit, 26), 500)) offset greatest(0, least(coalesce(p_offset, 0), 10000));
end;
$$;

create function public.ge_add_measurement(
  p_event uuid, p_scenario text, p_kind text, p_label text, p_quantity bigint, p_area numeric,
  p_grammage numeric, p_paper_factor numeric, p_frequency integer, p_source text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ge_require_owner(p_event);
  insert into public.measurements (
    event_id, scenario, kind, label, quantity, area_m2, grammage_g_m2, paper_factor, frequency, source
  ) values (
    p_event, p_scenario, p_kind, trim(p_label), p_quantity, p_area, p_grammage, p_paper_factor, p_frequency, trim(p_source)
  );
end;
$$;

create function public.ge_remove_measurement(p_event uuid, p_measurement uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ge_require_owner(p_event);
  delete from public.measurements where id = p_measurement and event_id = p_event;
end;
$$;

create function public.ge_impact_totals(p_event uuid)
returns table (scenario text, kind text, sheets numeric, mass_kg numeric, paper_kg_co2e numeric, transfer_gb numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ge_require_owner(p_event);
  return query
    select m.scenario, m.kind,
      sum(m.quantity) filter (where m.kind = 'paper'),
      sum(m.quantity * m.area_m2 * m.grammage_g_m2 / 1000),
      sum(m.quantity * m.area_m2 * m.grammage_g_m2 * m.paper_factor / 1000),
      sum(m.quantity::numeric * m.frequency / 1000000000)
    from public.measurements m where m.event_id = p_event group by m.scenario, m.kind;
end;
$$;

revoke all on function public.ge_require_role(text), public.ge_require_owner(uuid) from public, anon, authenticated;

revoke all on function public.ge_agenda(text, text, integer), public.ge_registered_count(uuid)
from public, anon, authenticated;
grant execute on function public.ge_agenda(text, text, integer), public.ge_registered_count(uuid)
to anon, authenticated;

revoke all on function
  public.ge_save_event(uuid,text,text,text,text,timestamptz,integer), public.ge_registration_status(uuid,text),
  public.ge_register(uuid), public.ge_set_window(uuid,timestamptz,timestamptz), public.ge_checkin_info(uuid),
  public.ge_checkin(uuid), public.ge_attendance_action(uuid,uuid,text,text), public.ge_event_stats(uuid),
  public.ge_roster(uuid,integer,integer),
  public.ge_add_measurement(uuid,text,text,text,bigint,numeric,numeric,numeric,integer,text),
  public.ge_remove_measurement(uuid,uuid), public.ge_impact_totals(uuid)
from public, anon, authenticated;
grant execute on function
  public.ge_save_event(uuid,text,text,text,text,timestamptz,integer), public.ge_registration_status(uuid,text),
  public.ge_register(uuid), public.ge_set_window(uuid,timestamptz,timestamptz), public.ge_checkin_info(uuid),
  public.ge_checkin(uuid), public.ge_attendance_action(uuid,uuid,text,text), public.ge_event_stats(uuid),
  public.ge_roster(uuid,integer,integer),
  public.ge_add_measurement(uuid,text,text,text,bigint,numeric,numeric,numeric,integer,text),
  public.ge_remove_measurement(uuid,uuid), public.ge_impact_totals(uuid)
to authenticated;

commit;
