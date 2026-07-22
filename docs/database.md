# Supabase database contract

This document records the database surface used by the current application. It is derived from the source code, not from an exported production schema. Confirm column types, defaults, and existing policies in Supabase before turning it into a migration.

## Relationships

```text
auth.users
  ├── profiles.user_id
  ├── student_profiles.user_id
  ├── student_resumes.user_id
  ├── companies.owner_user_id
  └── appointments.student_id

companies.id
  ├── company_profiles.company_id
  ├── company_positions.company_id
  └── time_slots.company_id

time_slots.id
  └── appointments.slot_id
```

## Tables used by the application

### `profiles`

General account record:

- `user_id`: UUID, unique, references `auth.users.id`
- `role`: text; application values are `student`, `company`, and `admin`
- `display_name`: nullable text

### `student_profiles`

One row per student account:

- `user_id`: UUID, unique, references `auth.users.id`
- `display_name`, `major`, `class_year`, `work_authorization`, `bio`: nullable text
- `gpa`: nullable numeric
- `open_to_relocation`: nullable boolean
- `preferred_locations`, `interested_role_types`, `preferred_work_modes`, `industries_of_interest`, `skills`: nullable text arrays

### `companies`

One company record per company owner:

- `id`: UUID primary key
- `owner_user_id`: UUID, unique, references `auth.users.id`
- `company_name`: text
- `description`, `website`, `domain`, `places_query`: nullable text
- `majors`, `skills`, `job_types`, `locations`: nullable text arrays
- `min_gpa`: nullable numeric
- `sponsorship_available`: boolean

### `company_profiles`

Externally enriched company information:

- `company_id`: UUID, unique, references `companies.id`
- `short_description`, `long_description`, `industry`, `location`, `website`, `logo_url`, `headquarters`, `company_size`: nullable text
- `rating`: nullable numeric
- `review_count`: nullable integer
- `hiring_types`, `majors`, `skills`: nullable text arrays
- `external_source`, `external_place_id`: nullable text
- `last_refreshed_at`: nullable timestamp with time zone

### `company_positions`

- `id`: UUID primary key
- `company_id`: UUID, references `companies.id`
- `title`: text
- `location_city`, `location_state`, `location_country`, `location_label`: nullable text
- `work_mode`: nullable text; UI values are `On-site`, `Hybrid`, and `Remote`
- `openings`: integer
- `majors`, `skills`: nullable text arrays
- `description`: nullable text
- `created_at`: timestamp with time zone

### `time_slots`

- `id`: UUID primary key
- `company_id`: UUID, references `companies.id`
- `start_time`, `end_time`: timestamp with time zone
- `capacity`: positive integer

### `appointments`

- `id`: UUID primary key
- `slot_id`: UUID, references `time_slots.id`
- `student_id`: UUID, references `auth.users.id`
- `status`: text; current scheduling logic reads `booked`
- `created_at`: timestamp with time zone

Add a unique constraint on `(slot_id, student_id)` unless repeat bookings for the same slot are intentionally supported. Capacity enforcement should be performed transactionally in the database rather than relying only on the browser’s pre-check.

### `student_resumes`

- `id`: UUID primary key
- `user_id`: UUID, references `auth.users.id`
- `file_name`, `file_path`: text
- `raw_text`: nullable text
- `parsed_json`: nullable JSONB
- `created_at`: timestamp with time zone

## Storage

Create a private bucket named `resumes`. Objects are written under `{auth.uid()}/{random-id}.{extension}`. Storage policies should allow authenticated users to create and read only objects whose first path segment equals their own user ID.

## Roles, permissions, and RLS

The versioned migration in `supabase/migrations/` creates `app_roles`, `app_permissions`, and `role_permissions`, plus an `authorize(permission)` database helper. Application routes use the matching permission keys from `lib/permissions.ts`; database policies remain the security boundary.

- Students can use student pages, read company opportunities, and manage only their own appointments.
- Company users can manage only the company they own, its positions, and its time slots. They can read appointments attached to that company.
- Administrators can enter any company workspace through an explicit company selection and manage all non-sensitive application records.
- Resume records and files remain owner-only, including for administrators.
- Public clients cannot create an administrator account or change their own role. Promotions must run through a trusted SQL or service-role process.

The RBAC migration intentionally replaces all policies on CareerKey's public tables. Review any pre-existing policies on `storage.objects` separately and remove broad policies that could expose the `resumes` bucket. PostgreSQL permissive policies combine with OR.

The service-role key bypasses RLS. Its use must remain limited to authenticated server routes with explicit resource authorization.

## Applying the migration

Confirm the live schema matches this contract, then apply `supabase/migrations/20260722190000_permission_based_rbac.sql` using the Supabase CLI or SQL editor. Test with one account for each role before promoting the production administrator account.
