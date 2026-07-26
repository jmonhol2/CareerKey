-- Event-specific company personnel counts govern capacity for every company slot.

create table if not exists public.company_event_settings (
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.recruiting_events(id) on delete cascade,
  personnel_count integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (company_id, event_id),
  constraint company_event_settings_valid_personnel check (
    personnel_count between 1 and 500
  )
);

alter table public.company_event_settings enable row level security;

drop policy if exists "Company users and admins can read event personnel" on public.company_event_settings;
drop policy if exists "Company users and admins can create event personnel" on public.company_event_settings;
drop policy if exists "Company users and admins can update event personnel" on public.company_event_settings;
drop policy if exists "Company users and admins can delete event personnel" on public.company_event_settings;

create policy "Company users and admins can read event personnel"
on public.company_event_settings for select to authenticated
using (public.can_manage_company(company_id));

create policy "Company users and admins can create event personnel"
on public.company_event_settings for insert to authenticated
with check (public.can_manage_company(company_id));

create policy "Company users and admins can update event personnel"
on public.company_event_settings for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy "Company users and admins can delete event personnel"
on public.company_event_settings for delete to authenticated
using (public.can_manage_company(company_id));

create or replace function public.validate_company_event_personnel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.recruiting_events as scheduled_event
    where scheduled_event.id = new.event_id
      and scheduled_event.is_active
  ) then
    raise exception 'Personnel can only be configured for the active event';
  end if;

  if exists (
    select 1
    from public.time_slots as slot
    where slot.company_id = new.company_id
      and slot.event_id = new.event_id
      and (
        select count(*)
        from public.appointments as appointment
        where appointment.slot_id = slot.id
          and appointment.status = 'booked'
      ) > new.personnel_count
  ) then
    raise exception 'Personnel count cannot be lower than the number of booked appointments in a slot';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists validate_company_event_personnel on public.company_event_settings;
create trigger validate_company_event_personnel
before insert or update on public.company_event_settings
for each row execute function public.validate_company_event_personnel();

create or replace function public.sync_company_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.time_slots
  set capacity = new.personnel_count
  where company_id = new.company_id
    and event_id = new.event_id
    and capacity is distinct from new.personnel_count;

  return new;
end;
$$;

drop trigger if exists sync_company_slot_capacity on public.company_event_settings;
create trigger sync_company_slot_capacity
after insert or update of personnel_count on public.company_event_settings
for each row execute function public.sync_company_slot_capacity();

create or replace function public.set_time_slot_personnel_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_personnel integer;
begin
  select settings.personnel_count into configured_personnel
  from public.company_event_settings as settings
  where settings.company_id = new.company_id
    and settings.event_id = new.event_id;

  if configured_personnel is null then
    raise exception 'Set the company personnel count before creating time slots';
  end if;

  new.capacity = configured_personnel;
  return new;
end;
$$;

drop trigger if exists set_time_slot_personnel_capacity on public.time_slots;
create trigger set_time_slot_personnel_capacity
before insert or update of company_id, event_id, capacity on public.time_slots
for each row execute function public.set_time_slot_personnel_capacity();

notify pgrst, 'reload schema';
