-- Named company personnel, automatic full-event availability, breaks, and personnel booking.

create table if not exists public.company_personnel (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  role_title text not null,
  bio text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (id, company_id)
);

create table if not exists public.company_event_personnel (
  company_id uuid not null,
  event_id uuid not null references public.recruiting_events(id) on delete cascade,
  personnel_id uuid not null,
  created_at timestamp with time zone not null default now(),
  primary key (event_id, personnel_id),
  foreign key (personnel_id, company_id)
    references public.company_personnel(id, company_id) on delete cascade,
  foreign key (company_id, event_id)
    references public.company_event_settings(company_id, event_id) on delete cascade
    deferrable initially deferred
);

create table if not exists public.personnel_breaks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  event_id uuid not null,
  personnel_id uuid not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  note text,
  created_at timestamp with time zone not null default now(),
  foreign key (personnel_id, company_id)
    references public.company_personnel(id, company_id) on delete cascade,
  foreign key (event_id, personnel_id)
    references public.company_event_personnel(event_id, personnel_id) on delete cascade,
  constraint personnel_breaks_valid_window check (end_time > start_time)
);

alter table public.appointments
add column if not exists personnel_id uuid references public.company_personnel(id) on delete restrict;

create unique index if not exists appointments_one_person_per_slot_idx
on public.appointments (slot_id, personnel_id)
where personnel_id is not null and status = 'booked';

alter table public.company_personnel enable row level security;
alter table public.company_event_personnel enable row level security;
alter table public.personnel_breaks enable row level security;

drop policy if exists "Company users and admins can read personnel" on public.company_personnel;
drop policy if exists "Company users and admins can create personnel" on public.company_personnel;
drop policy if exists "Company users and admins can update personnel" on public.company_personnel;
drop policy if exists "Company users and admins can delete personnel" on public.company_personnel;
drop policy if exists "Company users and admins can read event personnel" on public.company_event_personnel;
drop policy if exists "Company users and admins can create event personnel" on public.company_event_personnel;
drop policy if exists "Company users and admins can update event personnel" on public.company_event_personnel;
drop policy if exists "Company users and admins can delete event personnel" on public.company_event_personnel;
drop policy if exists "Company users and admins can read personnel breaks" on public.personnel_breaks;
drop policy if exists "Company users and admins can create personnel breaks" on public.personnel_breaks;
drop policy if exists "Company users and admins can update personnel breaks" on public.personnel_breaks;
drop policy if exists "Company users and admins can delete personnel breaks" on public.personnel_breaks;

create policy "Company users and admins can read personnel"
on public.company_personnel for select to authenticated
using (public.authorize('companies.read'));
create policy "Company users and admins can create personnel"
on public.company_personnel for insert to authenticated
with check (public.can_manage_company(company_id));
create policy "Company users and admins can update personnel"
on public.company_personnel for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));
create policy "Company users and admins can delete personnel"
on public.company_personnel for delete to authenticated
using (public.can_manage_company(company_id));

create policy "Company users and admins can read event personnel"
on public.company_event_personnel for select to authenticated
using (public.can_manage_company(company_id));
create policy "Company users and admins can create event personnel"
on public.company_event_personnel for insert to authenticated
with check (public.can_manage_company(company_id));
create policy "Company users and admins can update event personnel"
on public.company_event_personnel for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));
create policy "Company users and admins can delete event personnel"
on public.company_event_personnel for delete to authenticated
using (public.can_manage_company(company_id));

create policy "Company users and admins can read personnel breaks"
on public.personnel_breaks for select to authenticated
using (public.can_manage_company(company_id));
create policy "Company users and admins can create personnel breaks"
on public.personnel_breaks for insert to authenticated
with check (public.can_manage_company(company_id));
create policy "Company users and admins can update personnel breaks"
on public.personnel_breaks for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));
create policy "Company users and admins can delete personnel breaks"
on public.personnel_breaks for delete to authenticated
using (public.can_manage_company(company_id));

-- Replace the prior aggregate capacity trigger: capacity now equals named staff
-- who are assigned to the event and not on break for the slot.
create or replace function public.set_time_slot_personnel_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  available_personnel integer;
begin
  select count(*) into available_personnel
  from public.company_event_personnel as assignment
  where assignment.company_id = new.company_id
    and assignment.event_id = new.event_id
    and not exists (
      select 1
      from public.personnel_breaks as personnel_break
      where personnel_break.event_id = assignment.event_id
        and personnel_break.personnel_id = assignment.personnel_id
        and personnel_break.start_time < new.end_time
        and personnel_break.end_time > new.start_time
    );

  if available_personnel < 1 then
    raise exception 'At least one named personnel profile must be available for this slot';
  end if;

  new.capacity = available_personnel;
  return new;
end;
$$;

create or replace function public.refresh_company_event_slots(
  requested_company_id uuid,
  requested_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_event public.recruiting_events%rowtype;
  total_personnel integer;
  available_personnel integer;
  slot_start timestamp with time zone;
  slot_end timestamp with time zone;
begin
  select * into scheduled_event
  from public.recruiting_events
  where id = requested_event_id;

  if not found then
    raise exception 'Recruiting event not found';
  end if;

  select count(*) into total_personnel
  from public.company_event_personnel
  where company_id = requested_company_id
    and event_id = requested_event_id;

  if total_personnel = 0 then
    delete from public.time_slots as slot
    where slot.company_id = requested_company_id
      and slot.event_id = requested_event_id
      and not exists (
        select 1 from public.appointments as appointment
        where appointment.slot_id = slot.id and appointment.status = 'booked'
      );
    delete from public.company_event_settings
    where company_id = requested_company_id and event_id = requested_event_id;
    return;
  end if;

  insert into public.company_event_settings (company_id, event_id, personnel_count)
  values (requested_company_id, requested_event_id, total_personnel)
  on conflict (company_id, event_id)
  do update set personnel_count = excluded.personnel_count, updated_at = now();

  for slot_start in
    select generate_series(
      scheduled_event.start_time,
      scheduled_event.end_time - make_interval(mins => scheduled_event.slot_duration_minutes),
      make_interval(mins => scheduled_event.slot_duration_minutes)
    )
  loop
    slot_end := slot_start + make_interval(mins => scheduled_event.slot_duration_minutes);

    select count(*) into available_personnel
    from public.company_event_personnel as assignment
    where assignment.company_id = requested_company_id
      and assignment.event_id = requested_event_id
      and not exists (
        select 1
        from public.personnel_breaks as personnel_break
        where personnel_break.event_id = requested_event_id
          and personnel_break.personnel_id = assignment.personnel_id
          and personnel_break.start_time < slot_end
          and personnel_break.end_time > slot_start
      );

    if available_personnel > 0 then
      insert into public.time_slots (
        company_id, event_id, start_time, end_time, capacity
      ) values (
        requested_company_id, requested_event_id, slot_start, slot_end, available_personnel
      )
      on conflict (company_id, event_id, start_time)
      where event_id is not null
      do update set end_time = excluded.end_time, capacity = excluded.capacity;
    else
      delete from public.time_slots as slot
      where slot.company_id = requested_company_id
        and slot.event_id = requested_event_id
        and slot.start_time = slot_start
        and not exists (
          select 1 from public.appointments as appointment
          where appointment.slot_id = slot.id and appointment.status = 'booked'
        );
    end if;
  end loop;
end;
$$;

create or replace function public.validate_event_personnel_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.appointments as appointment
      join public.time_slots as slot on slot.id = appointment.slot_id
      where appointment.personnel_id = old.personnel_id
        and slot.event_id = old.event_id
        and appointment.status = 'booked'
    ) then
      raise exception 'Personnel with booked appointments cannot be removed from the event';
    end if;
    return old;
  end if;

  if not exists (
    select 1 from public.recruiting_events
    where id = new.event_id and is_active
  ) then
    raise exception 'Personnel can only be assigned to the active event';
  end if;

  return new;
end;
$$;

create or replace function public.refresh_slots_after_personnel_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_company_event_slots(
    case when tg_op = 'DELETE' then old.company_id else new.company_id end,
    case when tg_op = 'DELETE' then old.event_id else new.event_id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_event_personnel_assignment on public.company_event_personnel;
create trigger validate_event_personnel_assignment
before insert or update or delete on public.company_event_personnel
for each row execute function public.validate_event_personnel_assignment();

drop trigger if exists refresh_slots_after_personnel_change on public.company_event_personnel;
create trigger refresh_slots_after_personnel_change
after insert or update or delete on public.company_event_personnel
for each row execute function public.refresh_slots_after_personnel_change();

create or replace function public.validate_personnel_break()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_event public.recruiting_events%rowtype;
begin
  select * into scheduled_event
  from public.recruiting_events
  where id = new.event_id and is_active;

  if not found
    or new.start_time < scheduled_event.start_time
    or new.end_time > scheduled_event.end_time
    or new.end_time <= new.start_time then
    raise exception 'Breaks must remain inside the active event window';
  end if;

  if mod(
    extract(epoch from (new.start_time - scheduled_event.start_time))::numeric,
    (scheduled_event.slot_duration_minutes * 60)::numeric
  ) <> 0 or mod(
    extract(epoch from (new.end_time - scheduled_event.start_time))::numeric,
    (scheduled_event.slot_duration_minutes * 60)::numeric
  ) <> 0 then
    raise exception 'Break times must align with event appointment intervals';
  end if;

  if exists (
    select 1
    from public.appointments as appointment
    join public.time_slots as slot on slot.id = appointment.slot_id
    where appointment.personnel_id = new.personnel_id
      and appointment.status = 'booked'
      and slot.start_time < new.end_time
      and slot.end_time > new.start_time
  ) then
    raise exception 'This break conflicts with an appointment already booked for the personnel member';
  end if;

  return new;
end;
$$;

create or replace function public.refresh_slots_after_break_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_company_event_slots(
    case when tg_op = 'DELETE' then old.company_id else new.company_id end,
    case when tg_op = 'DELETE' then old.event_id else new.event_id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_personnel_break on public.personnel_breaks;
create trigger validate_personnel_break
before insert or update on public.personnel_breaks
for each row execute function public.validate_personnel_break();

drop trigger if exists refresh_slots_after_break_change on public.personnel_breaks;
create trigger refresh_slots_after_break_change
after insert or update or delete on public.personnel_breaks
for each row execute function public.refresh_slots_after_break_change();

create or replace function public.validate_appointment_personnel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.personnel_id is null then
    raise exception 'Choose a company personnel member for the appointment';
  end if;

  if not exists (
    select 1
    from public.time_slots as slot
    join public.company_event_personnel as assignment
      on assignment.company_id = slot.company_id
      and assignment.event_id = slot.event_id
      and assignment.personnel_id = new.personnel_id
    where slot.id = new.slot_id
      and not exists (
        select 1 from public.personnel_breaks as personnel_break
        where personnel_break.event_id = slot.event_id
          and personnel_break.personnel_id = new.personnel_id
          and personnel_break.start_time < slot.end_time
          and personnel_break.end_time > slot.start_time
      )
  ) then
    raise exception 'The selected personnel member is unavailable for this time slot';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment_personnel on public.appointments;
create trigger validate_appointment_personnel
before insert or update of slot_id, personnel_id on public.appointments
for each row execute function public.validate_appointment_personnel();

create or replace function public.get_company_event_personnel_availability(
  requested_company_id uuid,
  requested_event_id uuid
)
returns table (
  slot_id uuid,
  personnel_id uuid,
  personnel_name text,
  role_title text,
  bio text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    slot.id,
    personnel.id,
    personnel.name,
    personnel.role_title,
    personnel.bio
  from public.time_slots as slot
  join public.company_event_personnel as assignment
    on assignment.company_id = slot.company_id
    and assignment.event_id = slot.event_id
  join public.company_personnel as personnel on personnel.id = assignment.personnel_id
  where slot.company_id = requested_company_id
    and slot.event_id = requested_event_id
    and public.authorize('companies.read')
    and not exists (
      select 1 from public.personnel_breaks as personnel_break
      where personnel_break.event_id = slot.event_id
        and personnel_break.personnel_id = personnel.id
        and personnel_break.start_time < slot.end_time
        and personnel_break.end_time > slot.start_time
    )
    and not exists (
      select 1 from public.appointments as appointment
      where appointment.slot_id = slot.id
        and appointment.personnel_id = personnel.id
        and appointment.status = 'booked'
    )
  order by slot.start_time, personnel.name;
$$;

create or replace function public.book_personnel_slot(
  p_slot_id uuid,
  p_personnel_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_slot public.time_slots%rowtype;
  appointment_id uuid;
begin
  if auth.uid() is null or not public.authorize('appointments.manage.own') then
    raise exception 'Student appointment permission is required';
  end if;

  select * into requested_slot
  from public.time_slots
  where id = p_slot_id
  for update;

  if not found then raise exception 'Time slot not found'; end if;

  if not exists (
    select 1
    from public.company_event_personnel as assignment
    where assignment.company_id = requested_slot.company_id
      and assignment.event_id = requested_slot.event_id
      and assignment.personnel_id = p_personnel_id
  ) then
    raise exception 'Personnel member is not assigned to this event';
  end if;

  if exists (
    select 1 from public.personnel_breaks as personnel_break
    where personnel_break.event_id = requested_slot.event_id
      and personnel_break.personnel_id = p_personnel_id
      and personnel_break.start_time < requested_slot.end_time
      and personnel_break.end_time > requested_slot.start_time
  ) then
    raise exception 'Personnel member is on break during this time';
  end if;

  if exists (
    select 1 from public.appointments
    where slot_id = p_slot_id
      and personnel_id = p_personnel_id
      and status = 'booked'
  ) then
    raise exception 'Personnel member has already been booked for this time';
  end if;

  if exists (
    select 1
    from public.appointments as appointment
    join public.time_slots as slot on slot.id = appointment.slot_id
    where appointment.student_id = auth.uid()
      and appointment.status = 'booked'
      and slot.start_time < requested_slot.end_time
      and slot.end_time > requested_slot.start_time
  ) then
    raise exception 'You already have an appointment during this time';
  end if;

  insert into public.appointments (slot_id, student_id, personnel_id, status)
  values (p_slot_id, auth.uid(), p_personnel_id, 'booked')
  returning id into appointment_id;

  return appointment_id;
end;
$$;

grant execute on function public.get_company_event_personnel_availability(uuid, uuid) to authenticated;
grant execute on function public.book_personnel_slot(uuid, uuid) to authenticated;
revoke all on function public.refresh_company_event_slots(uuid, uuid) from public;

notify pgrst, 'reload schema';
