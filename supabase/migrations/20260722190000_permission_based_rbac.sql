-- CareerKey permission-based RBAC and row-level security baseline.
-- Keep the permission keys in sync with lib/permissions.ts.

create table if not exists public.app_roles (
  role text primary key,
  description text not null
);

create table if not exists public.app_permissions (
  permission text primary key,
  description text not null
);

create table if not exists public.role_permissions (
  role text not null references public.app_roles(role) on delete cascade,
  permission text not null references public.app_permissions(permission) on delete cascade,
  primary key (role, permission)
);

insert into public.app_roles (role, description) values
  ('student', 'Student account'),
  ('company', 'Company account'),
  ('admin', 'CareerKey administrator')
on conflict (role) do update set description = excluded.description;

insert into public.app_permissions (permission, description) values
  ('dashboard.view', 'Open the authenticated dashboard'),
  ('student.portal', 'Open student pages'),
  ('company.portal', 'Open company pages'),
  ('admin.portal', 'Open administrator pages'),
  ('companies.read', 'Read company listings and profiles'),
  ('companies.manage.own', 'Manage an owned company'),
  ('companies.manage.all', 'Manage any company'),
  ('positions.manage.own', 'Manage positions for an owned company'),
  ('positions.manage.all', 'Manage positions for any company'),
  ('slots.manage.own', 'Manage slots for an owned company'),
  ('slots.manage.all', 'Manage slots for any company'),
  ('appointments.manage.own', 'Manage appointments booked by the current student'),
  ('appointments.read.company', 'Read appointments for an owned company'),
  ('appointments.manage.all', 'Manage all appointments'),
  ('roles.manage', 'Manage account roles through a trusted server process')
on conflict (permission) do update set description = excluded.description;

delete from public.role_permissions where role in ('student', 'company', 'admin');

insert into public.role_permissions (role, permission) values
  ('student', 'dashboard.view'),
  ('student', 'student.portal'),
  ('student', 'companies.read'),
  ('student', 'appointments.manage.own'),
  ('company', 'dashboard.view'),
  ('company', 'company.portal'),
  ('company', 'companies.read'),
  ('company', 'companies.manage.own'),
  ('company', 'positions.manage.own'),
  ('company', 'slots.manage.own'),
  ('company', 'appointments.read.company'),
  ('admin', 'dashboard.view'),
  ('admin', 'student.portal'),
  ('admin', 'company.portal'),
  ('admin', 'admin.portal'),
  ('admin', 'companies.read'),
  ('admin', 'companies.manage.own'),
  ('admin', 'companies.manage.all'),
  ('admin', 'positions.manage.own'),
  ('admin', 'positions.manage.all'),
  ('admin', 'slots.manage.own'),
  ('admin', 'slots.manage.all'),
  ('admin', 'appointments.manage.own'),
  ('admin', 'appointments.read.company'),
  ('admin', 'appointments.manage.all'),
  ('admin', 'roles.manage')
on conflict do nothing;

create or replace function public.authorize(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.role_permissions as role_permission
      on role_permission.role = profile.role
    where profile.user_id = (select auth.uid())
      and role_permission.permission = requested_permission
  );
$$;

create or replace function public.can_manage_company(requested_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.authorize('companies.manage.all')
    or exists (
      select 1
      from public.companies as company
      where company.id = requested_company_id
        and company.owner_user_id = (select auth.uid())
        and public.authorize('companies.manage.own')
    );
$$;

grant execute on function public.authorize(text) to authenticated;
grant execute on function public.can_manage_company(uuid) to authenticated;
grant select on public.app_roles, public.app_permissions, public.role_permissions to authenticated;

create or replace function public.protect_profile_identity_and_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SQL editor and service-role operations have no authenticated user context and
  -- are the trusted path for promotions. Browser clients can only create one of
  -- the two public account types and can never promote themselves.
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.user_id is distinct from auth.uid() then
        raise exception 'A profile can only be created for the signed-in user';
      end if;
      if new.role not in ('student', 'company') then
        raise exception 'Public signup only supports student and company roles';
      end if;
    elsif new.user_id is distinct from old.user_id then
      raise exception 'Profile ownership cannot be changed';
    elsif new.role is distinct from old.role then
      raise exception 'Account roles can only be changed through a trusted admin process';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_identity_and_role on public.profiles;
create trigger protect_profile_identity_and_role
before insert or update on public.profiles
for each row execute function public.protect_profile_identity_and_role();

-- Replace legacy policies on CareerKey's public tables. PostgreSQL combines
-- permissive policies with OR, so leaving an older broad policy would weaken RBAC.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'app_roles', 'app_permissions', 'role_permissions', 'profiles',
        'student_profiles', 'companies', 'company_profiles',
        'company_positions', 'time_slots', 'appointments', 'student_resumes'
      ])
  loop
    execute format(
      'drop policy %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_profiles enable row level security;
alter table public.company_positions enable row level security;
alter table public.time_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.student_resumes enable row level security;

create policy "Authenticated users can read roles"
on public.app_roles for select to authenticated using (true);
create policy "Authenticated users can read permissions"
on public.app_permissions for select to authenticated using (true);
create policy "Authenticated users can read role permissions"
on public.role_permissions for select to authenticated using (true);

create policy "Users can read relevant profiles"
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.authorize('admin.portal')
  or exists (
    select 1
    from public.appointments as appointment
    join public.time_slots as slot on slot.id = appointment.slot_id
    join public.companies as company on company.id = slot.company_id
    where appointment.student_id = profiles.user_id
      and company.owner_user_id = (select auth.uid())
      and public.authorize('appointments.read.company')
  )
);
create policy "Users can create their own public profile"
on public.profiles for insert to authenticated
with check (user_id = (select auth.uid()) and role in ('student', 'company'));
create policy "Users and admins can update profiles"
on public.profiles for update to authenticated
using (user_id = (select auth.uid()) or public.authorize('admin.portal'))
with check (user_id = (select auth.uid()) or public.authorize('admin.portal'));
create policy "Admins can delete profiles"
on public.profiles for delete to authenticated
using (public.authorize('admin.portal'));

create policy "Students and admins can read student profiles"
on public.student_profiles for select to authenticated
using (user_id = (select auth.uid()) or public.authorize('admin.portal'));
create policy "Students and admins can create student profiles"
on public.student_profiles for insert to authenticated
with check (user_id = (select auth.uid()) or public.authorize('admin.portal'));
create policy "Students and admins can update student profiles"
on public.student_profiles for update to authenticated
using (user_id = (select auth.uid()) or public.authorize('admin.portal'))
with check (user_id = (select auth.uid()) or public.authorize('admin.portal'));
create policy "Students and admins can delete student profiles"
on public.student_profiles for delete to authenticated
using (user_id = (select auth.uid()) or public.authorize('admin.portal'));

create policy "Authorized users can read companies"
on public.companies for select to authenticated
using (public.authorize('companies.read'));
create policy "Company users and admins can create companies"
on public.companies for insert to authenticated
with check (
  (owner_user_id = (select auth.uid()) and public.authorize('companies.manage.own'))
  or public.authorize('companies.manage.all')
);
create policy "Company users and admins can update companies"
on public.companies for update to authenticated
using (public.can_manage_company(id))
with check (public.can_manage_company(id));
create policy "Company users and admins can delete companies"
on public.companies for delete to authenticated
using (public.can_manage_company(id));

create policy "Authorized users can read company profiles"
on public.company_profiles for select to authenticated
using (public.authorize('companies.read'));
create policy "Company users and admins can create company profiles"
on public.company_profiles for insert to authenticated
with check (public.can_manage_company(company_id));
create policy "Company users and admins can update company profiles"
on public.company_profiles for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));
create policy "Company users and admins can delete company profiles"
on public.company_profiles for delete to authenticated
using (public.can_manage_company(company_id));

create policy "Authorized users can read positions"
on public.company_positions for select to authenticated
using (public.authorize('companies.read'));
create policy "Company users and admins can create positions"
on public.company_positions for insert to authenticated
with check (
  public.authorize('positions.manage.all')
  or (public.authorize('positions.manage.own') and public.can_manage_company(company_id))
);
create policy "Company users and admins can update positions"
on public.company_positions for update to authenticated
using (
  public.authorize('positions.manage.all')
  or (public.authorize('positions.manage.own') and public.can_manage_company(company_id))
)
with check (
  public.authorize('positions.manage.all')
  or (public.authorize('positions.manage.own') and public.can_manage_company(company_id))
);
create policy "Company users and admins can delete positions"
on public.company_positions for delete to authenticated
using (
  public.authorize('positions.manage.all')
  or (public.authorize('positions.manage.own') and public.can_manage_company(company_id))
);

create policy "Authorized users can read time slots"
on public.time_slots for select to authenticated
using (public.authorize('companies.read'));
create policy "Company users and admins can create time slots"
on public.time_slots for insert to authenticated
with check (
  public.authorize('slots.manage.all')
  or (public.authorize('slots.manage.own') and public.can_manage_company(company_id))
);
create policy "Company users and admins can update time slots"
on public.time_slots for update to authenticated
using (
  public.authorize('slots.manage.all')
  or (public.authorize('slots.manage.own') and public.can_manage_company(company_id))
)
with check (
  public.authorize('slots.manage.all')
  or (public.authorize('slots.manage.own') and public.can_manage_company(company_id))
);
create policy "Company users and admins can delete time slots"
on public.time_slots for delete to authenticated
using (
  public.authorize('slots.manage.all')
  or (public.authorize('slots.manage.own') and public.can_manage_company(company_id))
);

create policy "Users can read authorized appointments"
on public.appointments for select to authenticated
using (
  (student_id = (select auth.uid()) and public.authorize('appointments.manage.own'))
  or public.authorize('appointments.manage.all')
  or (
    public.authorize('appointments.read.company')
    and exists (
      select 1
      from public.time_slots as slot
      join public.companies as company on company.id = slot.company_id
      where slot.id = appointments.slot_id
        and company.owner_user_id = (select auth.uid())
    )
  )
);
create policy "Students and admins can create appointments"
on public.appointments for insert to authenticated
with check (
  (student_id = (select auth.uid()) and public.authorize('appointments.manage.own'))
  or public.authorize('appointments.manage.all')
);
create policy "Students and admins can update appointments"
on public.appointments for update to authenticated
using (
  (student_id = (select auth.uid()) and public.authorize('appointments.manage.own'))
  or public.authorize('appointments.manage.all')
)
with check (
  (student_id = (select auth.uid()) and public.authorize('appointments.manage.own'))
  or public.authorize('appointments.manage.all')
);
create policy "Students and admins can delete appointments"
on public.appointments for delete to authenticated
using (
  (student_id = (select auth.uid()) and public.authorize('appointments.manage.own'))
  or public.authorize('appointments.manage.all')
);

-- Resumes intentionally remain owner-only, including for administrators.
create policy "Students can read their own resume records"
on public.student_resumes for select to authenticated
using (user_id = (select auth.uid()));
create policy "Students can create their own resume records"
on public.student_resumes for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Students can update their own resume records"
on public.student_resumes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "Students can delete their own resume records"
on public.student_resumes for delete to authenticated
using (user_id = (select auth.uid()));

-- These policies are deliberately scoped to the private `resumes` bucket.
-- Review and remove any older broad storage.objects policies in the dashboard,
-- because permissive PostgreSQL policies are combined with OR.
drop policy if exists "CareerKey users can read own resume objects" on storage.objects;
drop policy if exists "CareerKey users can upload own resume objects" on storage.objects;
drop policy if exists "CareerKey users can update own resume objects" on storage.objects;
drop policy if exists "CareerKey users can delete own resume objects" on storage.objects;

create policy "CareerKey users can read own resume objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "CareerKey users can upload own resume objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "CareerKey users can update own resume objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "CareerKey users can delete own resume objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
