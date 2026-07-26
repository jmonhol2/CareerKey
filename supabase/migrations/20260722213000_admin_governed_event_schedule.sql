-- Administrator-governed recruiting events and database-enforced slot windows.

insert into public.app_permissions (permission, description) values
  ('events.read', 'Read recruiting event schedules'),
  ('events.manage', 'Create and update recruiting event schedules')
on conflict (permission) do update set description = excluded.description;

insert into public.role_permissions (role, permission) values
  ('student', 'events.read'),
  ('company', 'events.read'),
  ('admin', 'events.read'),
  ('admin', 'events.manage')
on conflict do nothing;

create table if not exists public.recruiting_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  slot_duration_minutes integer not null default 15,
  timezone text not null default 'America/New_York',
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint recruiting_events_valid_window check (end_time > start_time),
  constraint recruiting_events_valid_duration check (
    slot_duration_minutes between 5 and 120
  )
);

create unique index if not exists recruiting_events_one_active_idx
on public.recruiting_events (is_active)
where is_active;

alter table public.time_slots
add column if not exists event_id uuid references public.recruiting_events(id) on delete restrict;

create unique index if not exists time_slots_company_event_start_idx
on public.time_slots (company_id, event_id, start_time)
where event_id is not null;

alter table public.recruiting_events enable row level security;

drop policy if exists "Authorized users can read recruiting events" on public.recruiting_events;
drop policy if exists "Admins can create recruiting events" on public.recruiting_events;
drop policy if exists "Admins can update recruiting events" on public.recruiting_events;
drop policy if exists "Admins can delete recruiting events" on public.recruiting_events;

create policy "Authorized users can read recruiting events"
on public.recruiting_events for select to authenticated
using (public.authorize('events.read'));

create policy "Admins can create recruiting events"
on public.recruiting_events for insert to authenticated
with check (public.authorize('events.manage'));

create policy "Admins can update recruiting events"
on public.recruiting_events for update to authenticated
using (public.authorize('events.manage'))
with check (public.authorize('events.manage'));

create policy "Admins can delete recruiting events"
on public.recruiting_events for delete to authenticated
using (public.authorize('events.manage'));

create or replace function public.validate_time_slot_event_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_event public.recruiting_events%rowtype;
begin
  if new.event_id is null then
    raise exception 'A time slot must belong to an administrator-scheduled event';
  end if;

  select * into scheduled_event
  from public.recruiting_events
  where id = new.event_id;

  if not found or not scheduled_event.is_active then
    raise exception 'Time slots can only be created for the active event';
  end if;

  if new.start_time < scheduled_event.start_time
    or new.end_time > scheduled_event.end_time
    or new.end_time <= new.start_time then
    raise exception 'Time slot must remain inside the active event window';
  end if;

  if new.end_time - new.start_time
    <> make_interval(mins => scheduled_event.slot_duration_minutes) then
    raise exception 'Time slot must use the event slot duration of % minutes',
      scheduled_event.slot_duration_minutes;
  end if;

  if mod(
    extract(epoch from (new.start_time - scheduled_event.start_time))::numeric,
    (scheduled_event.slot_duration_minutes * 60)::numeric
  ) <> 0 then
    raise exception 'Time slot must begin on an administrator-defined event interval';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_time_slot_event_window on public.time_slots;
create trigger validate_time_slot_event_window
before insert or update of event_id, start_time, end_time on public.time_slots
for each row execute function public.validate_time_slot_event_window();

create or replace function public.protect_event_schedule_with_slots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.time_slots as slot
    where slot.event_id = old.id
      and (
        slot.start_time < new.start_time
        or slot.end_time > new.end_time
        or slot.end_time - slot.start_time
          <> make_interval(mins => new.slot_duration_minutes)
        or mod(
          extract(epoch from (slot.start_time - new.start_time))::numeric,
          (new.slot_duration_minutes * 60)::numeric
        ) <> 0
      )
  ) then
    raise exception 'The revised schedule conflicts with existing company slots';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protect_event_schedule_with_slots on public.recruiting_events;
create trigger protect_event_schedule_with_slots
before update on public.recruiting_events
for each row execute function public.protect_event_schedule_with_slots();

create or replace function public.validate_appointment_active_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.time_slots as slot
    join public.recruiting_events as scheduled_event on scheduled_event.id = slot.event_id
    where slot.id = new.slot_id
      and scheduled_event.is_active
      and slot.start_time >= scheduled_event.start_time
      and slot.end_time <= scheduled_event.end_time
  ) then
    raise exception 'Appointments can only be booked during the active event';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment_active_event on public.appointments;
create trigger validate_appointment_active_event
before insert or update of slot_id on public.appointments
for each row execute function public.validate_appointment_active_event();

-- Ask PostgREST to recognize the newly created table and columns immediately.
notify pgrst, 'reload schema';
